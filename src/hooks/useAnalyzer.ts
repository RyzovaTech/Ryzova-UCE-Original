import { useCallback, useEffect, useRef, useState } from 'react';
import { readZip } from '@/lib/analyzer/zip';
import { analyzeProject } from '@/lib/analyzer/analyzer';
import { getDemoProjectFiles, DEMO_PROJECT_NAME } from '@/lib/analyzer/demoProject';
import { getGitHubArchiveUrl, parseGitHubRepositoryUrl } from '@/lib/analyzer/repository';
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

const MAX_ARCHIVE_SIZE = 50 * 1024 * 1024;
const REMOTE_FETCH_TIMEOUT = 30_000;
const CANCELLED_MESSAGE = 'Analysis cancelled.';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT);
  const abortFromCaller = () => controller.abort();
  init.signal?.addEventListener('abort', abortFromCaller, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export function useAnalyzer() {
  const [state, setState] = useState<AnalyzerState>(INITIAL_STATE);
  const mountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const requestIdRef = useRef(0);
  const remoteAbortRef = useRef<AbortController | null>(null);

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

  useEffect(() => () => {
    mountedRef.current = false;
    remoteAbortRef.current?.abort();
    clearAnalysisTimeout();
  }, [clearAnalysisTimeout]);

  const startRequest = useCallback(() => {
    if (runningRef.current) throw new Error('An analysis is already running. Cancel it first or wait for it to complete.');
    const requestId = ++requestIdRef.current;
    runningRef.current = true;
    return requestId;
  }, []);

  const ensureCurrentRequest = useCallback((requestId: number) => {
    if (requestId !== requestIdRef.current) throw new Error(CANCELLED_MESSAGE);
  }, []);

  const cancel = useCallback(() => {
    requestIdRef.current += 1;
    remoteAbortRef.current?.abort();
    remoteAbortRef.current = null;
    clearAnalysisTimeout();
    runningRef.current = false;
    safeSetState({ ...INITIAL_STATE, stage: 'idle' });
  }, [safeSetState, clearAnalysisTimeout]);

  const runAnalysis = useCallback(
    async (files: import('@/lib/analyzer/types').ProjectFile[], name: string, source: 'upload' | 'demo' | 'github', scanStats: import('@/lib/analyzer/types').ScanStats, requestId: number): Promise<AnalysisResult> => {
      ensureCurrentRequest(requestId);
      safeSetState((s) => ({ ...s, stage: 'reading', progress: STAGE_PROGRESS.reading, error: null }));
      await delay(300);
      ensureCurrentRequest(requestId);

      safeSetState((s) => ({ ...s, stage: 'detecting', progress: STAGE_PROGRESS.detecting }));
      await delay(300);
      ensureCurrentRequest(requestId);

      safeSetState((s) => ({ ...s, stage: 'analyzing', progress: STAGE_PROGRESS.analyzing }));
      await delay(400);
      ensureCurrentRequest(requestId);

      safeSetState((s) => ({ ...s, stage: 'scoring', progress: STAGE_PROGRESS.scoring }));
      await delay(200);
      ensureCurrentRequest(requestId);

      safeSetState((s) => ({ ...s, stage: 'reporting', progress: STAGE_PROGRESS.reporting }));
      await delay(150);
      ensureCurrentRequest(requestId);

      try {
        const result = analyzeProject({ files, fileName: name, source, scanStats });
        ensureCurrentRequest(requestId);
        saveReportToHistory(result);
        clearAnalysisTimeout();
        safeSetState({ stage: 'completed', result, error: null, progress: 100 });
        if (requestId === requestIdRef.current) runningRef.current = false;
        return result;
      } catch (e) {
        if (requestId === requestIdRef.current) runningRef.current = false;
        clearAnalysisTimeout();
        const message = e instanceof Error ? e.message : 'Analysis failed unexpectedly.';
        if (requestId === requestIdRef.current) safeSetState({ stage: 'error', result: null, error: message, progress: 0 });
        throw e;
      }
    },
    [safeSetState, clearAnalysisTimeout, ensureCurrentRequest]
  );

  const analyzeArchive = useCallback(
    async (file: File, source: 'upload' | 'github', requestId = startRequest()): Promise<AnalysisResult> => {
      if (requestId !== requestIdRef.current) throw new Error(CANCELLED_MESSAGE);
      if (file.size > MAX_ARCHIVE_SIZE) {
        const mb = (file.size / (1024 * 1024)).toFixed(1);
        const msg = `The uploaded file is ${mb}MB. The maximum supported size is 50MB.`;
        safeSetState({ stage: 'error', error: msg, progress: 0 });
        runningRef.current = false;
        return Promise.reject(new Error(msg));
      }
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
        ensureCurrentRequest(requestId);
        return await runAnalysis(files, name, source, scanStats, requestId);
      } catch (e) {
        clearAnalysisTimeout();
        if (requestId === requestIdRef.current) runningRef.current = false;
        const raw = e instanceof Error ? e.message : 'Failed to read the uploaded file.';
        const message = /zip|corrupt|invalid|crc|bad archive/i.test(raw)
          ? 'The archive could not be read. It may be corrupted or in an unsupported format.'
          : raw;
        if (requestId === requestIdRef.current) safeSetState({ stage: 'error', error: message, progress: 0 });
        throw e;
      }
    },
    [safeSetState, runAnalysis, clearAnalysisTimeout, ensureCurrentRequest, startRequest]
  );

  const analyzeFile = useCallback(
    (file: File): Promise<AnalysisResult> => analyzeArchive(file, 'upload'),
    [analyzeArchive]
  );

  const analyzeDemo = useCallback(async (): Promise<AnalysisResult> => {
    const requestId = startRequest();
    const files = getDemoProjectFiles();
    return await runAnalysis(files, DEMO_PROJECT_NAME, 'demo', {
      projectSize: files.reduce((sum, f) => sum + (f.content?.length ?? 0), 0),
      filesFound: files.length,
      filesAnalyzed: files.length,
      filesIgnored: 0,
      ignoredCategories: [],
    }, requestId);
  }, [runAnalysis, startRequest]);

  const analyzeGithub = useCallback(
    async (url: string): Promise<AnalysisResult> => {
      let requestId = -1;
      try {
        requestId = startRequest();
        const repository = parseGitHubRepositoryUrl(url);
        safeSetState((s) => ({ ...s, stage: 'uploading', progress: STAGE_PROGRESS.uploading, error: null }));
        remoteAbortRef.current = new AbortController();
        const metadata = await fetchWithTimeout(repository.metadataUrl, {
          headers: { Accept: 'application/vnd.github+json' },
          signal: remoteAbortRef.current.signal,
        });
        ensureCurrentRequest(requestId);
        if (!metadata.ok) throw new Error(`GitHub returned ${metadata.status}. The repository may be private, unavailable, or does not exist.`);
        const details: unknown = await metadata.json();
        const defaultBranch = typeof (details as { default_branch?: unknown }).default_branch === 'string'
          ? (details as { default_branch: string }).default_branch
          : null;
        if (!defaultBranch) throw new Error('GitHub did not provide a default branch for this repository.');

        remoteAbortRef.current = new AbortController();
        const res = await fetchWithTimeout(getGitHubArchiveUrl(repository, defaultBranch), { signal: remoteAbortRef.current.signal });
        ensureCurrentRequest(requestId);
        if (!res.ok) throw new Error(`GitHub returned ${res.status} while downloading the default branch.`);
        const contentType = res.headers.get('content-type') ?? '';
        if (contentType && !/application\/(zip|octet-stream)|application\/x-zip-compressed/i.test(contentType)) {
          throw new Error('GitHub returned an unexpected response instead of a ZIP archive.');
        }
        const contentLength = Number(res.headers.get('content-length') ?? 0);
        if (contentLength > MAX_ARCHIVE_SIZE) {
          throw new Error(`The repository archive is ${(contentLength / (1024 * 1024)).toFixed(1)}MB. The maximum supported size is 50MB.`);
        }
        const blob = await res.blob();
        ensureCurrentRequest(requestId);
        if (blob.size > MAX_ARCHIVE_SIZE) {
          throw new Error(`The repository archive is ${(blob.size / (1024 * 1024)).toFixed(1)}MB. The maximum supported size is 50MB.`);
        }
        const file = new File([blob], `${repository.repository}.zip`, { type: 'application/zip' });
        return await analyzeArchive(file, 'github', requestId);
      } catch (e) {
        clearAnalysisTimeout();
        if (requestId === requestIdRef.current) runningRef.current = false;
        const message = e instanceof DOMException && e.name === 'AbortError'
          ? 'GitHub did not respond within 30 seconds. Check your connection and try again.'
          : e instanceof TypeError && /failed to fetch/i.test(e.message)
            ? 'Could not connect to GitHub. Your browser, network, or content-security policy may be blocking GitHub downloads.'
            : e instanceof Error ? e.message : 'Failed to fetch GitHub repository.';
        if (requestId === requestIdRef.current) safeSetState({ stage: 'error', error: message, progress: 0 });
        throw e;
      }
    },
    [safeSetState, analyzeArchive, clearAnalysisTimeout, ensureCurrentRequest, startRequest]
  );

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    remoteAbortRef.current?.abort();
    clearAnalysisTimeout();
    runningRef.current = false;
    safeSetState(INITIAL_STATE);
  }, [safeSetState, clearAnalysisTimeout]);

  return { state, analyzeFile, analyzeDemo, analyzeGithub, reset, cancel, isRunning: runningRef.current };
}
