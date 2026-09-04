import { useCallback, useRef, useState } from 'react';
import { readZip } from '@/lib/analyzer/zip';
import { analyzeProject } from '@/lib/analyzer/analyzer';
import { getDemoProjectFiles, DEMO_PROJECT_NAME } from '@/lib/analyzer/demoProject';
import { saveReportToHistory } from '@/lib/storage';
import type { AnalysisResult, AnalysisStage } from '@/lib/analyzer/types';

export interface AnalyzerState {
  stage: AnalysisStage;
  progress: number;
  result: AnalysisResult | null;
  error: string | null;
}

const INITIAL_STATE: AnalyzerState = {
  stage: 'idle',
  progress: 0,
  result: null,
  error: null,
};

const STAGE_PROGRESS: Record<AnalysisStage, number> = {
  idle: 0,
  uploading: 5,
  reading: 20,
  detecting: 40,
  analyzing: 60,
  scoring: 80,
  reporting: 90,
  completed: 100,
  error: 0,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPublicGithubRepository(url: string): string[] | null {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.trim());
  } catch {
    return null;
  }

  const segments = parsedUrl.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '').split('/');
  return parsedUrl.protocol === 'https:' &&
    parsedUrl.hostname === 'github.com' &&
    segments.length === 2 &&
    segments.every(Boolean)
    ? segments
    : null;
}

export function useAnalyzer() {
  const [state, setState] = useState<AnalyzerState>(INITIAL_STATE);
  const mountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRef = useRef(false);
  const runningRef = useRef(false);

  const safeSetState = useCallback((update: Partial<AnalyzerState> | ((prev: AnalyzerState) => AnalyzerState)) => {
    if (mountedRef.current) {
      setState(update as React.SetStateAction<AnalyzerState>);
    }
  }, []);

  const clearAnalysisTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    clearAnalysisTimeout();
    runningRef.current = false;
    safeSetState({ ...INITIAL_STATE, stage: 'idle' });
  }, [safeSetState, clearAnalysisTimeout]);

  const runAnalysis = useCallback(
    async (files: import('@/lib/analyzer/types').ProjectFile[], name: string, source: 'upload' | 'demo' | 'github', scanStats: import('@/lib/analyzer/types').ScanStats): Promise<AnalysisResult> => {
      if (runningRef.current) return Promise.reject(new Error('An analysis is already running. Please wait for it to finish or cancel it.'));
      runningRef.current = true;
      cancelRef.current = false;
      safeSetState((s) => ({ ...s, stage: 'reading', progress: STAGE_PROGRESS.reading, error: null }));
      await delay(300);
      if (cancelRef.current) { runningRef.current = false; throw new Error('Analysis cancelled.'); }

      safeSetState((s) => ({ ...s, stage: 'detecting', progress: STAGE_PROGRESS.detecting }));
      await delay(300);
      if (cancelRef.current) { runningRef.current = false; throw new Error('Analysis cancelled.'); }

      safeSetState((s) => ({ ...s, stage: 'analyzing', progress: STAGE_PROGRESS.analyzing }));
      await delay(400);
      if (cancelRef.current) { runningRef.current = false; throw new Error('Analysis cancelled.'); }

      safeSetState((s) => ({ ...s, stage: 'scoring', progress: STAGE_PROGRESS.scoring }));
      await delay(200);
      if (cancelRef.current) { runningRef.current = false; throw new Error('Analysis cancelled.'); }

      safeSetState((s) => ({ ...s, stage: 'reporting', progress: STAGE_PROGRESS.reporting }));
      await delay(150);
      if (cancelRef.current) { runningRef.current = false; throw new Error('Analysis cancelled.'); }

      try {
        const result = analyzeProject({ files, fileName: name, source, scanStats });
        if (cancelRef.current) { runningRef.current = false; throw new Error('Analysis cancelled.'); }
        saveReportToHistory(result);
        clearAnalysisTimeout();
        safeSetState({ stage: 'completed', result, error: null, progress: 100 });
        runningRef.current = false;
        return result;
      } catch (e) {
        runningRef.current = false;
        clearAnalysisTimeout();
        const message = e instanceof Error ? e.message : 'Analysis failed unexpectedly.';
        safeSetState({ stage: 'error', result: null, error: message, progress: 0 });
        throw e;
      }
    },
    [safeSetState, clearAnalysisTimeout]
  );

  const readAndAnalyzeZip = useCallback(
    async (file: File, source: 'upload' | 'github'): Promise<AnalysisResult> => {
      const { files, name, scanStats } = await readZip(file);
      if (files.length === 0) {
        const message = 'The archive contains no files. Check the ZIP contents and try again.';
        safeSetState({ stage: 'error', error: message, progress: 0 });
        throw new Error(message);
      }
      if (cancelRef.current) throw new Error('Analysis cancelled.');
      return runAnalysis(files, name, source, scanStats);
    },
    [runAnalysis, safeSetState]
  );

  const analyzeFile = useCallback(
    async (file: File): Promise<AnalysisResult> => {
      if (runningRef.current) {
        safeSetState({ stage: 'error', error: 'An analysis is already running. Cancel it first or wait for it to complete.', progress: 0 });
        return Promise.reject(new Error('An analysis is already running.'));
      }
      const MAX_ZIP_SIZE = 50 * 1024 * 1024;
      if (file.size > MAX_ZIP_SIZE) {
        const mb = (file.size / (1024 * 1024)).toFixed(1);
        const msg = `The uploaded file is ${mb}MB. The maximum supported size is 50MB.`;
        safeSetState({ stage: 'error', error: msg, progress: 0 });
        return Promise.reject(new Error(msg));
      }
      cancelRef.current = false;
      timeoutRef.current = setTimeout(() => {
        safeSetState({ stage: 'error', error: 'Analysis timed out. The file may be too large or the archive may be malformed.', progress: 0 });
        runningRef.current = false;
      }, 60_000);

      safeSetState((s) => ({ ...s, stage: 'uploading', progress: STAGE_PROGRESS.uploading, error: null }));
      try {
        return await readAndAnalyzeZip(file, 'upload');
      } catch (e) {
        clearAnalysisTimeout();
        runningRef.current = false;
        const raw = e instanceof Error ? e.message : 'Failed to read the uploaded file.';
        const message = /zip|corrupt|invalid|crc|bad archive/i.test(raw)
          ? 'The archive could not be read. It may be corrupted or in an unsupported format.'
          : raw;
        safeSetState({ stage: 'error', error: message, progress: 0 });
        throw e;
      }
    },
    [safeSetState, readAndAnalyzeZip, clearAnalysisTimeout]
  );

  const analyzeDemo = useCallback(async (): Promise<AnalysisResult> => {
    const files = getDemoProjectFiles();
    return await runAnalysis(files, DEMO_PROJECT_NAME, 'demo', {
      projectSize: files.reduce((sum, f) => sum + (f.content?.length ?? 0), 0),
      filesFound: files.length,
      filesAnalyzed: files.length,
      filesIgnored: 0,
      ignoredCategories: [],
    });
  }, [runAnalysis]);

  const analyzeGithub = useCallback(
    async (url: string): Promise<AnalysisResult> => {
      if (runningRef.current) {
        const msg = 'An analysis is already running. Cancel it first or wait for it to complete.';
        safeSetState({ stage: 'error', error: msg, progress: 0 });
        return Promise.reject(new Error(msg));
      }
      const segments = getPublicGithubRepository(url);
      if (!segments) {
        const message = 'Enter a public GitHub repository URL in the format https://github.com/owner/repository.';
        safeSetState({ stage: 'error', error: message, progress: 0 });
        return Promise.reject(new Error(message));
      }
      timeoutRef.current = setTimeout(() => {
        safeSetState({ stage: 'error', error: 'Repository analysis timed out. Try a smaller public repository.', progress: 0 });
        runningRef.current = false;
      }, 60_000);
      safeSetState((s) => ({ ...s, stage: 'uploading', progress: STAGE_PROGRESS.uploading, error: null }));
      try {
        const repoName = segments.join('/');
        const metadata = await fetch(`https://api.github.com/repos/${repoName}`, { headers: { Accept: 'application/vnd.github+json' } });
        if (!metadata.ok) throw new Error(`GitHub returned ${metadata.status}. The repository may be private or unavailable.`);
        const { default_branch: defaultBranch } = await metadata.json() as { default_branch?: string };
        if (!defaultBranch) throw new Error('GitHub did not provide a default branch for this repository.');
        const archive = await fetch(`https://api.github.com/repos/${repoName}/zipball/${encodeURIComponent(defaultBranch)}`, { headers: { Accept: 'application/vnd.github+json' } });
        if (!archive.ok) throw new Error(`GitHub returned ${archive.status} while downloading the default branch.`);
        const blob = await archive.blob();
        if (blob.size > 50 * 1024 * 1024) throw new Error('The repository archive exceeds the 50MB local analysis limit.');
        const file = new File([blob], `${segments[1]}.zip`, { type: 'application/zip' });
        return await readAndAnalyzeZip(file, 'github');
      } catch (e) {
        clearAnalysisTimeout();
        runningRef.current = false;
        const message = e instanceof Error ? e.message : 'Failed to fetch GitHub repository.';
        safeSetState({ stage: 'error', error: message, progress: 0 });
        throw e;
      }
    },
    [safeSetState, readAndAnalyzeZip, clearAnalysisTimeout]
  );

  const reset = useCallback(() => {
    cancelRef.current = true;
    clearAnalysisTimeout();
    runningRef.current = false;
    safeSetState(INITIAL_STATE);
  }, [safeSetState, clearAnalysisTimeout]);

  return { state, analyzeFile, analyzeDemo, analyzeGithub, reset, cancel, isRunning: runningRef.current };
}
