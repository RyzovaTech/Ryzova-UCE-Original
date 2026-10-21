/**
 * Real browser Web Worker performance probe for a future WASM Trilogy.
 * NOT Souffle/Z3/cvc5, NOT imported into the production UCE analyzer.
 */
const MAX_TRANSFER_BYTES = 256 * 1024;
const MAX_WALL_MS = 3000;
const MAX_STALL_MS = 10000;
let nextRequestId = 0;
let active = false;

export function trilogyBrowserReleaseGate() {
  return Object.freeze({
    status: 'blocked',
    available: false,
    reason: 'Native Souffle and cvc5 have no validated browser WASM backends in UCE. No actual Trilogy proof is available.',
    requirements: [
      'Independent browser-capable Datalog and cvc5 solver modules with validated results.',
      'Real Z3 browser WebAssembly initialization, cancellation and peak memory profiling.',
      'COOP/COEP, CSP, ZIP upload and GitHub archive cross-origin smoke tests.',
      'Evidence-linked UNSAT parity with Node and deterministic fallback.',
    ],
  });
}

export async function tryTrilogyBrowserSolve() {
  return { status: 'unknown', verification: 'not-run', attempted: false,
    reason: trilogyBrowserReleaseGate().reason };
}

/**
 * One lazy worker per diagnostic, terminated on every exit. A 256 KiB
 * transferable input limit controls cloning pressure, NOT WASM heap/RSS.
 */
export async function profileTrilogyBrowserWorker({
  sampleBytes = 64 * 1024,
  maxWallMs = 2000,
  stallMs = 0,
  signal,
  workerFactory = () => new Worker(new URL('./probe.worker.mjs', import.meta.url), {type:'module'}),
} = {}) {
  const start = performance.now();
  const result = (reason, extra = {}) => ({
    status: 'unknown', kind: 'browser-resource-probe-only', reason,
    startupMs: null, taskMs: null, totalMs: Math.round((performance.now() - start) * 100) / 100,
    transferredBytes: 0, workerTerminated: false, peakWorkerRssMiB: null,
    memoryMeasurement: 'Portable worker RSS and peak WASM heap metrics are unavailable in browsers.',
    ...extra,
  });
  if (!Number.isInteger(sampleBytes) || sampleBytes < 1 || sampleBytes > MAX_TRANSFER_BYTES ||
      !Number.isInteger(maxWallMs) || maxWallMs < 1 || maxWallMs > MAX_WALL_MS ||
      !Number.isInteger(stallMs) || stallMs < 0 || stallMs > MAX_STALL_MS) {
    return result('input-budget-rejected');
  }
  if (signal?.aborted) return result('cancelled-before-start');
  if (active) return result('concurrency-budget-rejected');
  active = true;
  return new Promise(resolve => {
    let worker, timer = null, done = false;
    let startupMs = null, transferredBytes = 0, sentAt = null;
    const requestId = ++nextRequestId;
    const onAbort = () => finish('cancelled');
    const finish = (reason, extra = {}) => {
      if (done) return;
      done = true;
      if (timer !== null) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (worker) worker.onmessage = worker.onerror = worker.onmessageerror = null;
      worker?.terminate();
      active = false;
      resolve(result(reason, { startupMs, transferredBytes, workerTerminated: Boolean(worker), ...extra }));
    };
    try {
      worker = workerFactory();
      worker.onmessage = event => {
        const data = event.data;
        if (!data || typeof data !== 'object' || data.requestId !== requestId) {
          finish('invalid-worker-response');
          return;
        }
        if (data.kind === 'probe-ready' && startupMs === null) {
          startupMs = Math.round((performance.now() - start) * 100) / 100;
          sentAt = performance.now();
          const bytes = new Uint8Array(sampleBytes);
          for(let i = 0; i < bytes.length; i += 4096) bytes[i] = (i / 4096) & 255;
          transferredBytes = bytes.byteLength;
          try {
            worker.postMessage({kind:'probe-run', requestId, data:bytes.buffer, stallMs}, [bytes.buffer]);
            if (bytes.buffer.byteLength !== 0) finish('transferable-ownership-not-detached');
          } catch { finish('transfer-failed'); }
          return;
        }
        if (data.kind !== 'probe-complete' || startupMs === null ||
            !Number.isInteger(data.bytes) || data.bytes !== transferredBytes ||
            !Number.isFinite(data.processingMs) || data.processingMs < 0 ||
            !Number.isInteger(data.checksum)) {
          finish('invalid-worker-response'); return;
        }
        finish('probe-completed', { status:'probe-complete',
          taskMs: Math.round((performance.now() - sentAt) * 100) / 100,
          workerProcessingMs: data.processingMs, checksum:data.checksum });
      };
      worker.onerror = () => finish('worker-error');
      worker.onmessageerror = () => finish('worker-message-error');
      timer = setTimeout(() => finish('wall-time-budget-exceeded'), maxWallMs);
      signal?.addEventListener('abort', onAbort, {once:true});
      if (signal?.aborted) { onAbort(); return; }
      worker.postMessage({kind:'probe-init',requestId});
    } catch { finish('worker-construction-failed'); }
  });
}
