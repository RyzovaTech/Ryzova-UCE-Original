import { useCallback, useEffect, useRef, useState } from 'react';
import { readZip } from '@/lib/analyzer/zip';
import { loadCachedAnalysis, saveCachedAnalysis } from '@/lib/analyzer/cache';
import { markExecution, prepareAnalysisInput } from '@/lib/analyzer/execution';
import { getDemoProjectFiles, DEMO_PROJECT_NAME } from '@/lib/analyzer/demoProject';
import { getGitHubArchiveUrl, parseGitHubRepositoryUrl } from '@/lib/analyzer/repository';
import { saveReportToHistory } from '@/lib/storage';
import type { AnalysisInput, AnalysisResult, AnalysisStage } from '@/lib/analyzer/types';

export interface AnalyzerState {
  stage: AnalysisStage;
  progress: number;
  result: AnalysisResult | null;
  error: string | null;
  message: string | null;
  cacheHit: boolean;
  canResume: boolean;
  preview: { projectType: string; language: string; framework: string; runtime: string } | null;
}

const INITIAL_STATE: AnalyzerState = {
  stage: 'idle',
  progress: 0,
  result: null,
  error: null,
  message: null,
  cacheHit: false,
  canResume: false,
  preview: null,
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
  const workerRef = useRef<Worker | null>(null);
  const workerRejectRef = useRef<((error: Error) => void) | null>(null);
  const resumableRef = useRef<AnalysisInput | null>(null);

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
    workerRef.current?.terminate();
    workerRejectRef.current?.(new Error(CANCELLED_MESSAGE));
    workerRejectRef.current = null;
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
    workerRef.current?.terminate();
    workerRef.current = null;
    workerRejectRef.current?.(new Error(CANCELLED_MESSAGE));
    workerRejectRef.current = null;
    clearAnalysisTimeout();
    runningRef.current = false;
    safeSetState({ ...INITIAL_STATE, stage: 'idle', canResume: Boolean(resumableRef.current), message: resumableRef.current ? 'Cancelled safely. Resume restarts the prepared local scan.' : null });
  }, [safeSetState, clearAnalysisTimeout]);

  const runAnalysis = useCallback(
    async (files: import('@/lib/analyzer/types').ProjectFile[], name: string, source: 'upload' | 'demo' | 'github', scanStats: import('@/lib/analyzer/types').ScanStats, requestId: number): Promise<AnalysisResult> => {
      ensureCurrentRequest(requestId);
      try {
        safeSetState((s) => ({ ...s, stage: 'reading', progress: STAGE_PROGRESS.reading, error: null, cacheHit: false, canResume: false, message: 'Preparing a bounded, deterministic analysis input.' }));
        await delay(0);
        const prepared = prepareAnalysisInput({ files, fileName: name, source, scanStats });
        resumableRef.current = prepared.input;
        const cached = loadCachedAnalysis(prepared.cacheKey);
        let result: AnalysisResult;
        if (cached) {
          result = markExecution({ ...cached, id: `rpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString(), source }, true);
          safeSetState((s) => ({ ...s, stage: 'reporting', progress: 95, cacheHit: true, message: 'Reused a matching local analysis cache entry.' }));
        } else {
          result = await executeInWorker(prepared.input, requestId, workerRef, workerRejectRef, (stage, progress, message) => safeSetState((s) => ({ ...s, stage, progress, message })), (preview) => safeSetState((s) => ({ ...s, preview })));
          saveCachedAnalysis(prepared.cacheKey, result);
        }
        ensureCurrentRequest(requestId);
        saveReportToHistory(result);
        resumableRef.current = null;
        clearAnalysisTimeout();
        safeSetState({ stage: 'completed', result, error: null, progress: 100, message: cached ? 'Analysis complete from local cache.' : 'Analysis complete in a background worker.', cacheHit: Boolean(cached), canResume: false });
        if (requestId === requestIdRef.current) runningRef.current = false;
        return result;
      } catch (e) {
        if (requestId === requestIdRef.current) runningRef.current = false;
        clearAnalysisTimeout();
        const message = e instanceof Error ? e.message : 'Analysis failed unexpectedly.';
        if (requestId === requestIdRef.current) safeSetState({ ...INITIAL_STATE, stage: 'error', error: message, canResume: Boolean(resumableRef.current) });
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
        safeSetState({ ...INITIAL_STATE, stage: 'error', error: msg });
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
          safeSetState({ ...INITIAL_STATE, stage: 'error', error: msg });
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
        if (requestId === requestIdRef.current) safeSetState({ ...INITIAL_STATE, stage: 'error', error: message, canResume: Boolean(resumableRef.current) });
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
        if (requestId === requestIdRef.current) safeSetState({ ...INITIAL_STATE, stage: 'error', error: message, canResume: Boolean(resumableRef.current) });
        throw e;
      }
    },
    [safeSetState, analyzeArchive, clearAnalysisTimeout, ensureCurrentRequest, startRequest]
  );

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    remoteAbortRef.current?.abort();
    workerRef.current?.terminate();
    workerRef.current = null;
    workerRejectRef.current?.(new Error(CANCELLED_MESSAGE));
    workerRejectRef.current = null;
    resumableRef.current = null;
    clearAnalysisTimeout();
    runningRef.current = false;
    safeSetState(INITIAL_STATE);
  }, [safeSetState, clearAnalysisTimeout]);

  const resume = useCallback(async (): Promise<AnalysisResult> => {
    if (!resumableRef.current) throw new Error('No cancelled analysis is available to resume.');
    const requestId = startRequest();
    const input = resumableRef.current;
    return runAnalysis(input.files, input.fileName, input.source, input.scanStats, requestId);
  }, [runAnalysis, startRequest]);

  return { state, analyzeFile, analyzeDemo, analyzeGithub, reset, cancel, resume, isRunning: runningRef.current };
}

async function executeInWorker(
  input: AnalysisInput,
  requestId: number,
  workerRef: React.MutableRefObject<Worker | null>,
  workerRejectRef: React.MutableRefObject<((error: Error) => void) | null>,
  onProgress: (stage: AnalysisStage, progress: number, message: string) => void,
  onPreview: (preview: AnalyzerState['preview']) => void,
): Promise<AnalysisResult> {
  if (typeof Worker === 'undefined') {
    const { analyzeProject } = await import('@/lib/analyzer/analyzer');
    return markExecution(analyzeProject(input), false);
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../lib/analyzer/analysis.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    workerRejectRef.current = reject;
    worker.onmessage = (event: MessageEvent<{ type: string; requestId: number; stage?: AnalysisStage; progress?: number; message?: string; result?: AnalysisResult; preview?: NonNullable<AnalyzerState['preview']> }>) => {
      if (event.data.requestId !== requestId) return;
      if (event.data.type === 'progress' && event.data.stage && typeof event.data.progress === 'number') onProgress(event.data.stage, event.data.progress, event.data.message ?? 'Analysis in progress.');
      if (event.data.type === 'preview' && event.data.preview) onPreview(event.data.preview);
      if (event.data.type === 'complete' && event.data.result) { worker.terminate(); workerRef.current = null; workerRejectRef.current = null; resolve(event.data.result); }
      if (event.data.type === 'error') { worker.terminate(); workerRef.current = null; workerRejectRef.current = null; reject(new Error(event.data.message ?? 'Worker analysis failed.')); }
    };
    worker.onerror = (event) => { worker.terminate(); workerRef.current = null; workerRejectRef.current = null; reject(new Error(event.message || 'Worker analysis failed.')); };
    worker.postMessage({ type: 'analyze', requestId, input });
  });
}
