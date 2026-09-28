/// <reference lib="webworker" />
import { analyzeProject } from './analyzer';
import { classifyProject } from './classifier';
import { detectStack } from './detectors';
import { parseFiles } from './parser';
import { markExecution } from './execution';
import { prepareAnalysisInput } from './execution';
import { readZip } from './zip';
import type { AnalysisInput, AnalysisStage } from './types';

type Request = { type: 'analyze'; requestId: number; input: AnalysisInput }
  | { type: 'analyze-archive'; requestId: number; file: File; source: 'upload' | 'github'; displayName?: string }
  | { type: 'continue-archive'; requestId: number };
const workerScope = self as DedicatedWorkerGlobalScope;
const progress = (requestId: number, stage: AnalysisStage, value: number, message: string) => workerScope.postMessage({ type: 'progress', requestId, stage, progress: value, message });
const preparedArchives = new Map<number, ReturnType<typeof prepareAnalysisInput>>();

function analyze(input: AnalysisInput, requestId: number, cacheKey?: string): void {
  try {
    progress(requestId, 'detecting', 35, 'Detecting languages, technologies, and project identity.');
    const detectedFiles = parseFiles(input.files);
    const classification = classifyProject(input.files, detectedFiles);
    const stack = detectStack(input.files, detectedFiles);
    workerScope.postMessage({ type: 'preview', requestId, preview: { projectType: classification.type, language: stack.language, framework: stack.framework, runtime: stack.runtime } });
    progress(requestId, 'analyzing', 55, 'Running intelligence and compatibility modules.');
    const result = markExecution(analyzeProject(input), false);
    progress(requestId, 'scoring', 82, 'Calculating transparent compatibility scores.');
    progress(requestId, 'reporting', 94, 'Assembling report evidence and trust metadata.');
    workerScope.postMessage({ type: 'complete', requestId, result, cacheKey });
  } catch (error) {
    workerScope.postMessage({ type: 'error', requestId, message: error instanceof Error ? error.message : 'Worker analysis failed.' });
  }
}

workerScope.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  if (request.type === 'analyze') { analyze(request.input, request.requestId); return; }
  if (request.type === 'continue-archive') {
    const prepared = preparedArchives.get(request.requestId);
    if (!prepared) return;
    preparedArchives.delete(request.requestId);
    analyze(prepared.input, request.requestId, prepared.cacheKey);
    return;
  }
  const { requestId, file, source } = request;
  progress(requestId, 'reading', 15, 'Opening ZIP archive and indexing file names.');
  void readZip(file, (done, total) => {
    progress(requestId, 'reading', 20 + Math.floor(19 * done / Math.max(total, 1)), `Reading selected files: ${done.toLocaleString()} / ${total.toLocaleString()}.`);
  }, request.displayName).then(({ files, name, scanStats }) => {
    if (!files.length) throw new Error('The archive contains no files. Check the ZIP contents and try again.');
    const prepared = prepareAnalysisInput({ files, fileName: name, source, scanStats });
    preparedArchives.set(requestId, prepared);
    progress(requestId, 'reading', 39, `Indexed ${scanStats.filesFound.toLocaleString()} files; selected ${prepared.input.scanStats.filesAnalyzed.toLocaleString()}, with text content from ${prepared.input.scanStats.filesWithContent?.toLocaleString() ?? '0'}.`);
    workerScope.postMessage({ type: 'prepared', requestId, cacheKey: prepared.cacheKey });
  }).catch((error: unknown) => {
    workerScope.postMessage({ type: 'error', requestId, message: error instanceof Error ? error.message : 'Could not read ZIP archive.' });
  });
};

export {};
