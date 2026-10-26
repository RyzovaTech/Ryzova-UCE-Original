import type { AnalysisInput, AnalysisResult, AnalysisStage, ProjectFile } from './types';

// Rules and report version changed; never reuse cached V2 findings in a V3 scan.
export const ANALYSIS_CACHE_VERSION = 24;
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
  const directories = input.files.filter((file) => file.isDirectory).sort((a, b) => compareText(a.path, b.path));
  const candidates = input.files.filter((file) => !file.isDirectory).sort(comparePriority);
  const selected: ProjectFile[] = [];
  let contentBytes = 0;
  let contentTruncated = false;
  for (const file of candidates) {
    if (selected.length >= budget.maxFiles) break;
    const contentSize = file.content === undefined ? 0 : new TextEncoder().encode(file.content).byteLength;
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
    filesWithContent: selected.filter((file) => file.content !== undefined).length,
    sampled: fileSampled || Boolean(input.scanStats.sampled),
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

/**
 * Length-framed, four-lane (128-bit) non-cryptographic cache identity.
 * Reduces accidental 32-bit collisions. This is NOT a secure content digest.
 * Strings are streamed field by field, without joining large source buffers.
 */
function fingerprintFields(fields: Iterable<string>): string {
  let a = 0x811c9dc5, b = 0x9e3779b9, c = 0x85ebca6b, d = 0xc2b2ae35;
  let count = 0;
  const feed = (value: string) => {
    for (let i = 0; i < value.length; i++) {
      const ch = value.charCodeAt(i);
      a = Math.imul(a ^ ch, 0x01000193);
      b = Math.imul(b ^ (ch + 0x9e37), 0x27d4eb2d);
      c = Math.imul(c ^ (ch + 0x85eb), 0x85ebca6b);
      d = Math.imul(d ^ (ch + 0xc2b2), 0xc2b2ae35);
    }
  };
  for (const value of fields) {
    feed(String(value.length)); feed(':'); feed(value); feed(';');
    count++;
  }
  const mix = (value: number) => {
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b);
    return (value ^ (value >>> 16)) >>> 0;
  };
  return [a, b, c, d].map((v, i) =>
    mix(v ^ count ^ Math.imul(i + 1, 0x9e3779b1)).toString(16).padStart(8, '0')).join('');
}

/** Cache identity includes scope, coverage, sorted file metadata and content. */
function* inputFields(input: AnalysisInput): Generator<string> {
  const stats = input.scanStats;
  yield String(ANALYSIS_CACHE_VERSION);
  yield input.fileName;
  yield input.source;
  yield stats.archiveIndexSignature ?? '';
  yield String(stats.projectSize);
  yield String(stats.filesFound);
  yield String(stats.filesAnalyzed);
  yield String(stats.filesIgnored);
  yield String(stats.filesWithContent ?? '');
  yield String(Boolean(stats.sampled));
  yield String(Boolean(stats.truncated));
  yield String(Boolean(stats.findingsLimited));
  yield stats.truncationReason ?? '';
  yield String(stats.eligibleFiles ?? '');
  yield String(stats.filesInventoried ?? '');
  yield String(stats.coreFilesAnalyzed ?? '');
  yield String(stats.textFilesEligible ?? '');
  yield String(stats.textFilesTooLarge ?? '');
  yield String(stats.contentByteLimit ?? '');
  for (const category of [...stats.ignoredCategories].sort()) yield category;
  yield String(stats.ignoredCategories.length);
  const files = [...input.files].sort((left, right) =>
    compareText(left.path, right.path) ||
    Number(left.isDirectory) - Number(right.isDirectory) || left.size - right.size);
  for (const file of files) {
    yield file.path;
    yield String(file.size);
    yield file.isDirectory ? 'directory' : 'file';
    yield file.content === undefined ? 'no-content' : 'has-content';
    if (file.content !== undefined) yield file.content;
  }
  yield String(input.files.length);
}

export function fingerprintAnalysisInput(input: AnalysisInput): string {
  return 'uce' + ANALYSIS_CACHE_VERSION + '-' +
    fingerprintFields(inputFields(input)) + '-' + input.files.length;
}

export function canCacheAnalysisInput(input: AnalysisInput): boolean {
  const stats = input.scanStats;
  return !stats.sampled && !stats.truncated && !stats.findingsLimited &&
    !stats.ruleFailures?.length;
}

/** Incomplete or error-bearing results must not be reused as clean analysis. */
export function canCacheAnalysisResult(result: AnalysisResult): boolean {
  const stats = result.summary.scanStats;
  const v3 = result.stack.v3RulePlatform;
  const sweep = v3?.archiveSweep;
  return !stats.sampled && !stats.truncated && !stats.findingsLimited &&
    !stats.ruleFailures?.length &&
    result.summary.analysisCoverage?.status !== 'partial' &&
    !result.stack.securityIntelligence?.truncated &&
    !v3?.metrics.some(metric => metric.truncated) &&
    (!sweep || (sweep.complete && sweep.findingsOmitted === 0));
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
  return fingerprintFields([file.path, String(file.size),
    file.isDirectory ? 'directory' : 'file',
    file.content === undefined ? 'no-content' : 'has-content',
    file.content ?? '']);
}

export function markExecution(result: AnalysisResult, cached: boolean, worker = !cached): AnalysisResult {
  const sampled = Boolean(result.summary.scanStats.sampled);
  const truncated = Boolean(result.summary.scanStats.truncated);
  return { ...result, trust: { ...result.trust!, execution: { worker, cached, sampled, truncated } } };
}

function compareText(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }

function comparePriority(left: ProjectFile, right: ProjectFile): number {
  const rank = (file: ProjectFile) => PRIORITY_NAMES.test(file.path) ? 0 : PRIORITY_EXTENSIONS.test(file.path) ? 1 : 2;
  return rank(left) - rank(right) || left.size - right.size || compareText(left.path, right.path);
}
function formatBytes(value: number): string { return `${Math.round(value / 1024 / 1024)}MB`; }
