import type { AnalysisInput, AnalysisResult, AnalysisStage, ProjectFile } from './types';

export const ANALYSIS_CACHE_VERSION = 1;
export const DEFAULT_ANALYSIS_BUDGET = Object.freeze({
  maxFiles: 25_000,
  maxContentBytes: 96 * 1024 * 1024,
  maxSingleFileBytes: 2 * 1024 * 1024,
});

export interface AnalysisProgress {
  stage: AnalysisStage;
  progress: number;
  message: string;
}

export interface PreparedAnalysis {
  input: AnalysisInput;
  cacheKey: string;
}
export interface AnalysisInputDiff { added: string[]; changed: string[]; removed: string[]; unchanged: string[]; reusableRatio: number; }

const PRIORITY_NAMES = /(^|\/)(package\.json|pyproject\.toml|cargo\.toml|go\.mod|pom\.xml|composer\.json|dockerfile|readme(?:\.md)?|\.github\/workflows\/[^/]+)$/i;
const PRIORITY_EXTENSIONS = /\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|swift|rb|php|cs|cpp|c|h|vue|svelte|astro|json|ya?ml|toml)$/i;

export function prepareAnalysisInput(input: AnalysisInput, budget = DEFAULT_ANALYSIS_BUDGET): PreparedAnalysis {
  const directories = input.files.filter((file) => file.isDirectory);
  const candidates = input.files.filter((file) => !file.isDirectory).sort(comparePriority);
  const selected: ProjectFile[] = [];
  let contentBytes = 0;
  let contentTruncated = false;
  for (const file of candidates) {
    if (selected.length >= budget.maxFiles) break;
    const contentSize = file.content?.length ?? 0;
    if (contentSize > budget.maxSingleFileBytes || contentBytes + contentSize > budget.maxContentBytes) {
      selected.push({ ...file, content: undefined });
      contentTruncated ||= contentSize > 0;
      continue;
    }
    selected.push(file);
    contentBytes += contentSize;
  }
  const fileSampled = selected.length < candidates.length;
  const truncated = fileSampled || contentTruncated || Boolean(input.scanStats.truncated);
  const files = [...selected, ...directories.filter((directory) => selected.some((file) => file.path.startsWith(`${directory.path}/`)))];
  const scanStats = {
    ...input.scanStats,
    filesAnalyzed: selected.length,
    sampled: fileSampled,
    truncated,
    truncationReason: truncated
      ? [fileSampled ? `file budget ${budget.maxFiles.toLocaleString()}` : '', contentTruncated ? `content budget ${formatBytes(budget.maxContentBytes)}` : '', input.scanStats.truncationReason ?? ''].filter(Boolean).join('; ')
      : undefined,
    contentBytesRead: contentBytes,
    contentByteLimit: budget.maxContentBytes,
  };
  const prepared = { ...input, files, scanStats };
  return { input: prepared, cacheKey: fingerprintAnalysisInput(prepared) };
}

export function fingerprintAnalysisInput(input: AnalysisInput): string {
  let hash = 2166136261;
  const update = (value: string) => { for (let index = 0; index < value.length; index++) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } };
  update(`${ANALYSIS_CACHE_VERSION}|${input.fileName}|${input.source}|`);
  for (const file of input.files) {
    update(`${file.path}\0${file.size}\0${file.isDirectory ? 1 : 0}\0`);
    if (file.content) update(file.content.length <= 4096 ? file.content : `${file.content.slice(0, 2048)}${file.content.slice(-2048)}`);
  }
  return `uce${ANALYSIS_CACHE_VERSION}-${(hash >>> 0).toString(16).padStart(8, '0')}-${input.files.length}`;
}

/** Content-aware manifest diff used by resumable clients and future module caches. */
export function diffAnalysisInputs(previous: AnalysisInput, current: AnalysisInput): AnalysisInputDiff {
  const before = new Map(previous.files.filter((file) => !file.isDirectory).map((file) => [file.path, fingerprintFile(file)]));
  const after = new Map(current.files.filter((file) => !file.isDirectory).map((file) => [file.path, fingerprintFile(file)]));
  const added: string[] = []; const changed: string[] = []; const unchanged: string[] = [];
  for (const [path, fingerprint] of after) { if (!before.has(path)) added.push(path); else if (before.get(path) === fingerprint) unchanged.push(path); else changed.push(path); }
  const removed = [...before.keys()].filter((path) => !after.has(path));
  return { added, changed, removed, unchanged, reusableRatio: after.size ? unchanged.length / after.size : 1 };
}

function fingerprintFile(file: ProjectFile): string {
  let hash = 2166136261; const value = `${file.path}\0${file.size}\0${file.content ?? ''}`;
  for (let index = 0; index < value.length; index++) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function markExecution(result: AnalysisResult, cached: boolean): AnalysisResult {
  const sampled = Boolean(result.summary.scanStats.sampled);
  const truncated = Boolean(result.summary.scanStats.truncated);
  return { ...result, trust: { ...result.trust!, execution: { worker: true, cached, sampled, truncated } } };
}

function comparePriority(left: ProjectFile, right: ProjectFile): number {
  const rank = (file: ProjectFile) => PRIORITY_NAMES.test(file.path) ? 0 : PRIORITY_EXTENSIONS.test(file.path) ? 1 : 2;
  return rank(left) - rank(right) || left.size - right.size || left.path.localeCompare(right.path);
}
function formatBytes(value: number): string { return `${Math.round(value / 1024 / 1024)}MB`; }
