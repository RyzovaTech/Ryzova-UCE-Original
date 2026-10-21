import type { ProjectFile } from '../analyzer/types';
import { TRILOGY_PREFLIGHT_LIMITS, type TrilogyPreflight } from './trilogy-preflight';

export interface BrowserTrilogyPreflightOutcome {
  result: TrilogyPreflight;
  workerStarted: boolean;
  terminated: boolean;
  elapsedMs: number;
  workerMs: number | null;
  transferredBytes: number;
}
export interface BrowserTrilogyPreflightOptions {
  workspace?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}
let running = false;
let sequence = 0;
const safeWorkspace = (x: string) => x === '' || (x.length <= 120 &&
  /^[A-Za-z0-9_.@/-]+$/.test(x) &&
  x.split('/').every(s => s && s !== '.' && s !== '..'));
const unknown = (reason: string, workspace: string): TrilogyPreflight => ({
  version: 1, mode: 'browser-preflight-only', status: 'unknown', reason,
  solverStatus: 'not-run', nativeSolversAvailable: false, workspace,
  candidateConstraints: 0, inspectedPackages: 0, transitiveHint: false,
});
const fallback = (reason: string, workspace: string, elapsedMs: number,
  workerStarted = false, bytes = 0): BrowserTrilogyPreflightOutcome => ({
  result: unknown(reason, workspace), workerStarted,
  terminated: workerStarted, elapsedMs, workerMs: null,
  transferredBytes: bytes,
});

/**
 * EXPLICIT OPT-IN ONLY. This browser worker never loads Z3, Souffle, cvc5 or
 * their WASM; it checks a small source subset before a separate local Node
 * Trilogy decision. It is NOT imported by the default UCE analysis worker.
 *
 * Strict one-at-a-time, two-file / 256 KiB cap, termination on every path.
 * Browser APIs expose no portable per-worker heap metric; no fabricated
 * memory-measurement claim is made.
 */
export async function runBrowserTrilogyPreflight(
  files: ProjectFile[], options: BrowserTrilogyPreflightOptions = {},
): Promise<BrowserTrilogyPreflightOutcome> {
  const start = performance.now();
  const workspace = options.workspace ?? '';
  if (!safeWorkspace(workspace)) return fallback('Invalid workspace.', '', performance.now() - start);
  if (!Array.isArray(files)) return fallback('Invalid project files.', workspace, performance.now() - start);
  if (options.signal?.aborted) return fallback('Preflight cancelled.', workspace, performance.now() - start);
  if (running) return fallback('Preflight already running; concurrent worker cap is one.', workspace, performance.now() - start);
  const deadline = options.timeoutMs ?? 1500;
  if (!Number.isInteger(deadline) || deadline < 1 || deadline > 8000) {
    return fallback('Invalid worker deadline.', workspace, performance.now() - start);
  }
  const base = workspace ? workspace + '/' : '';
  const names = new Set([base + 'package.json', base + 'package-lock.json']);
  const selected = files.filter(f => !f.isDirectory && names.has(f.path));
  if (selected.length !== 2 || new Set(selected.map(f=>f.path)).size !== 2) {
    return fallback('Two unique same-workspace evidence files required.', workspace, performance.now() - start);
  }
  let bytes = 0;
  const reduced: { path: string; content: string; isDirectory: false }[] = [];
  for (const file of selected) {
    if (typeof file.content !== 'string') return fallback('Evidence text unavailable.', workspace, performance.now() - start);
    const size = new TextEncoder().encode(file.content).byteLength;
    if (size > TRILOGY_PREFLIGHT_LIMITS.maxFileBytes) {
      return fallback('Evidence exceeds individual transfer budget.', workspace, performance.now() - start);
    }
    bytes += size;
    if (bytes > TRILOGY_PREFLIGHT_LIMITS.maxTotalBytes) {
      return fallback('Evidence exceeds transfer budget.', workspace, performance.now() - start);
    }
    reduced.push({ path: file.path, content: file.content, isDirectory: false });
  }
  if (typeof Worker === 'undefined') return fallback('Browser Worker unavailable.', workspace, performance.now() - start);
  running = true;
  let worker: Worker;
  try {
    // Vite discovers this lazy module-worker URL but does not bundle native
    // engines. Worker is created only on an explicit caller invocation.
    worker = new Worker(new URL('./trilogy-preflight.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    running = false;
    return fallback('Browser Worker startup failed.', workspace, performance.now() - start);
  }
  const requestId = ++sequence;
  return new Promise(resolve => {
    let finished = false;
    let workerResult: TrilogyPreflight | null = null;
    let workerMs: number | null = null;
    let error = 'Preflight worker deadline exceeded.';
    const cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      running = false;
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve({
        result: workerResult ?? unknown(error, workspace),
        workerStarted: true, terminated: true,
        elapsedMs: Math.round((performance.now() - start) * 100) / 100,
        workerMs, transferredBytes: bytes,
      });
    };
    const onAbort = () => { error = 'Preflight cancelled.'; finish(); };
    const timer = setTimeout(finish, deadline);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    worker.onmessage = (event: MessageEvent<{
      type: string; requestId: number; value?: TrilogyPreflight; workerMs?: number;
    }>) => {
      if (!event.data || event.data.requestId !== requestId) return;
      const data = event.data;
      if (data.type !== 'result' || !data.value ||
          data.value.solverStatus !== 'not-run' ||
          data.value.nativeSolversAvailable !== false ||
          data.value.mode !== 'browser-preflight-only' ||
          !['candidate', 'skip', 'unknown'].includes(data.value.status)) {
        error = 'Unexpected browser preflight protocol.';
        finish();
        return;
      }
      workerResult = data.value;
      workerMs = typeof data.workerMs === 'number' && Number.isFinite(data.workerMs) ? data.workerMs : null;
      finish();
    };
    worker.onerror = () => { error = 'Browser preflight worker error.'; finish(); };
    if (options.signal?.aborted) { onAbort(); return; }
    try { worker.postMessage({ type: 'preflight', requestId, workspace, files: reduced }); }
    catch { error = 'Preflight transfer failed.'; finish(); }
  });
}
