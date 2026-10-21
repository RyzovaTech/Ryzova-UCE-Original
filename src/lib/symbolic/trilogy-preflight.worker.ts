/// <reference lib="webworker" />
import { inspectTrilogyCandidate } from './trilogy-preflight';
import type { ProjectFile } from '../analyzer/types';
type Request = { requestId: number; type: 'preflight'; workspace: string;
  files: Pick<ProjectFile, 'path'|'content'|'isDirectory'>[] };
const scope = self as DedicatedWorkerGlobalScope;

// This dedicated worker is deliberately short-lived. One message per worker;
// the client terminates after result/error/AbortSignal/deadline to release heap.
scope.onmessage = (event: MessageEvent<Request>) => {
  const data = event.data;
  if (!data || data.type !== 'preflight' ||
      !Number.isSafeInteger(data.requestId)) return;
  const start = performance.now();
  try {
    const value = inspectTrilogyCandidate(data.files, data.workspace);
    scope.postMessage({ type: 'result', requestId: data.requestId, value,
      workerMs: Math.round((performance.now() - start) * 100) / 100 });
  } catch {
    scope.postMessage({ type: 'error', requestId: data.requestId, reason: 'Preflight worker failed.' });
  }
};
export {};
