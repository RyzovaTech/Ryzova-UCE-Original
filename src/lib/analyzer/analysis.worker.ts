/// <reference lib="webworker" />
import { analyzeProject } from './analyzer';
import { classifyProject } from './classifier';
import { detectStack } from './detectors';
import { parseFiles } from './parser';
import { markExecution } from './execution';
import type { AnalysisInput, AnalysisStage } from './types';

type Request = { type: 'analyze'; requestId: number; input: AnalysisInput };
const workerScope = self as DedicatedWorkerGlobalScope;
const progress = (requestId: number, stage: AnalysisStage, value: number, message: string) => workerScope.postMessage({ type: 'progress', requestId, stage, progress: value, message });

workerScope.onmessage = (event: MessageEvent<Request>) => {
  if (event.data.type !== 'analyze') return;
  const { requestId, input } = event.data;
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
    workerScope.postMessage({ type: 'complete', requestId, result });
  } catch (error) {
    workerScope.postMessage({ type: 'error', requestId, message: error instanceof Error ? error.message : 'Worker analysis failed.' });
  }
};

export {};
