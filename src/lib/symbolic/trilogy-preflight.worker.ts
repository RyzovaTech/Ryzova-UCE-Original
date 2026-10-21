/// <reference lib="webworker" />
import { inspectTrilogyCandidate } from './trilogy-preflight';
type Request = { requestId: number; type: 'preflight'; workspace: string;
  files: { path: string; bytes: ArrayBuffer }[] };
const scope = self as DedicatedWorkerGlobalScope;

// This dedicated worker is deliberately short-lived. One message per worker;
// the client terminates after result/error/AbortSignal/deadline to release heap.
scope.onmessage = (event: MessageEvent<Request>) => {
  const data = event.data;
  if (!data || data.type !== 'preflight' ||
      !Number.isSafeInteger(data.requestId)) return;
  const start = performance.now();
  try {
    if (!Array.isArray(data.files) || data.files.length !== 2 || data.files.some(f =>
      !f || typeof f.path !== 'string' || !(f.bytes instanceof ArrayBuffer) ||
      f.bytes.byteLength > 128 * 1024)) throw new Error('Invalid transferred preflight data');
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const files = data.files.map(f => ({
      path: f.path, content: decoder.decode(f.bytes), isDirectory: false,
    }));
    const value = inspectTrilogyCandidate(files, data.workspace);
    scope.postMessage({ type: 'result', requestId: data.requestId, value,
      workerMs: Math.round((performance.now() - start) * 100) / 100 });
  } catch {
    scope.postMessage({ type: 'error', requestId: data.requestId, reason: 'Preflight worker failed.' });
  }
};
export {};
