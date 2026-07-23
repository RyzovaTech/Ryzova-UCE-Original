import { useCallback, useRef, useState } from 'react';
import { readZip } from '@/lib/analyzer/zip';
import { analyzeProject } from '@/lib/analyzer/analyzer';
import { getDemoProjectFiles, DEMO_PROJECT_NAME } from '@/lib/analyzer/demoProject';
import { saveReportToHistory } from '@/lib/storage';
import { incrementScanCount } from '@/lib/licensing/store';
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
        incrementScanCount();
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
        const { files, name, scanStats } = await readZip(file);
        if (files.length === 0) {
          runningRef.current = false;
          clearAnalysisTimeout();
          const msg = 'The archive contains no files. Check the ZIP contents and try again.';
          safeSetState({ stage: 'error', error: msg, progress: 0 });
          return Promise.reject(new Error(msg));
        }
        if (cancelRef.current) { runningRef.current = false; throw new Error('Analysis cancelled.'); }
        return await runAnalysis(files, name, 'upload', scanStats);
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
    [safeSetState, runAnalysis, clearAnalysisTimeout]
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
      safeSetState((s) => ({ ...s, stage: 'uploading', progress: STAGE_PROGRESS.uploading, error: null }));
      try {
        const repoName = url.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '') || 'github-project';
        const branches = ['main', 'master'];
        let res: Response | null = null;
        let lastStatus = 0;
        for (const branch of branches) {
          const apiUrl = `https://api.github.com/repos/${repoName}/zipball/${branch}`;
          const attempt = await fetch(apiUrl);
          if (attempt.ok) { res = attempt; break; }
          lastStatus = attempt.status;
        }
        if (!res || !res.ok) throw new Error(`GitHub API returned ${lastStatus}. The repository may be private or the default branch could not be found.`);
        const blob = await res.blob();
        const file = new File([blob], `${repoName.split('/').pop()}.zip`, { type: 'application/zip' });
        return await analyzeFile(file);
      } catch (e) {
        clearAnalysisTimeout();
        runningRef.current = false;
        const message = e instanceof Error ? e.message : 'Failed to fetch GitHub repository.';
        safeSetState({ stage: 'error', error: message, progress: 0 });
        throw e;
      }
    },
    [safeSetState, analyzeFile, clearAnalysisTimeout]
  );

  const reset = useCallback(() => {
    cancelRef.current = true;
    clearAnalysisTimeout();
    runningRef.current = false;
    safeSetState(INITIAL_STATE);
  }, [safeSetState, clearAnalysisTimeout]);

  return { state, analyzeFile, analyzeDemo, analyzeGithub, reset, cancel, isRunning: runningRef.current };
}
