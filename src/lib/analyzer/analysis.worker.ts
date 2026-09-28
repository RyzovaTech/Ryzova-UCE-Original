/// <reference lib="webworker" />
import { analyzeProject } from './analyzer';
import { classifyProject } from './classifier';
import { detectStack } from './detectors';
import { parseFiles } from './parser';
import { markExecution } from './execution';
import { prepareAnalysisInput } from './execution';
import { readZip } from './zip';
import { analyzeArchiveBatches } from './archive-batch-runner';
import type { AnalysisInput, AnalysisStage } from './types';

type Request = { type: 'analyze'; requestId: number; input: AnalysisInput }
  | { type: 'analyze-archive'; requestId: number; file: File; source: 'upload' | 'github'; displayName?: string }
  | { type: 'continue-archive'; requestId: number };
const workerScope = self as DedicatedWorkerGlobalScope;
const progress = (requestId: number, stage: AnalysisStage, value: number, message: string) => workerScope.postMessage({ type: 'progress', requestId, stage, progress: value, message });
const preparedArchives = new Map<number, { prepared: ReturnType<typeof prepareAnalysisInput>; file: File }>();

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
    const pending = preparedArchives.get(request.requestId);
    if (!pending) return;
    preparedArchives.delete(request.requestId);
    const { prepared, file } = pending;
    void (async () => {
      progress(request.requestId, 'detecting', 40, 'Detecting project identity and technology evidence.');
      const parsed = parseFiles(prepared.input.files);
      const identity = classifyProject(prepared.input.files, parsed);
      const stack = detectStack(prepared.input.files, parsed);
      workerScope.postMessage({ type: 'preview', requestId: request.requestId, preview: { projectType: identity.type, language: stack.language, framework: stack.framework, runtime: stack.runtime } });
      progress(request.requestId, 'analyzing', 55, 'Running cross-file intelligence and compatibility rules.');
      const result = prepared.input.scanStats.sampled || prepared.input.scanStats.truncated
        ? await analyzeArchiveBatches(file, prepared.input, (checked, eligible, resumeAvailable) => {
          progress(request.requestId, 'analyzing', 55 + Math.floor(36 * checked / Math.max(eligible, 1)), `Checking source batches: ${checked.toLocaleString()} / ${eligible.toLocaleString()} eligible files.${resumeAvailable ? ' Checkpoints saved locally.' : ''}`);
        })
        : analyzeProject(prepared.input);
      progress(request.requestId, 'reporting', 94, 'Assembling report and coverage evidence.');
      workerScope.postMessage({ type: 'complete', requestId: request.requestId, result: markExecution(result, false), cacheKey: prepared.cacheKey });
    })().catch((error: unknown) => {
      workerScope.postMessage({ type: 'error', requestId: request.requestId, message: error instanceof Error ? error.message : 'Archive analysis failed.' });
    });
    return;
  }
  const { requestId, file, source } = request;
  progress(requestId, 'reading', 15, 'Opening ZIP archive and indexing file names.');
  void readZip(file, (done, total) => {
    progress(requestId, 'reading', 20 + Math.floor(19 * done / Math.max(total, 1)), `Reading selected files: ${done.toLocaleString()} / ${total.toLocaleString()}.`);
  }, request.displayName).then(({ files, name, scanStats }) => {
    if (!files.length) throw new Error('The archive contains no files. Check the ZIP contents and try again.');
    const prepared = prepareAnalysisInput({ files, fileName: name, source, scanStats });
    preparedArchives.set(requestId, { prepared, file });
    progress(requestId, 'reading', 39, `Indexed ${scanStats.filesFound.toLocaleString()} files; selected ${prepared.input.scanStats.filesAnalyzed.toLocaleString()}, with text content from ${prepared.input.scanStats.filesWithContent?.toLocaleString() ?? '0'}.`);
    workerScope.postMessage({ type: 'prepared', requestId, cacheKey: prepared.cacheKey, cacheable: !prepared.input.scanStats.sampled && !prepared.input.scanStats.truncated });
  }).catch((error: unknown) => {
    workerScope.postMessage({ type: 'error', requestId, message: error instanceof Error ? error.message : 'Could not read ZIP archive.' });
  });
};

export {};
