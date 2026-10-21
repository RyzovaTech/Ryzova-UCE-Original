import type { ProjectFile } from '../analyzer/types';

/**
 * Conservative browser-only preflight for optional Node Trilogy jobs.
 * Does NOT solve SMT, verify a lockfile, run user code or assert compatibility.
 * Native Souffle/cvc5 are not browser modules. There is intentionally no Z3
 * WASM import or cross-origin isolation request in this file.
 */
export type PreflightStatus = 'candidate' | 'skip' | 'unknown';
export interface TrilogyPreflight {
  version: 1;
  mode: 'browser-preflight-only';
  status: PreflightStatus;
  reason: string;
  solverStatus: 'not-run';
  nativeSolversAvailable: false;
  workspace: string;
  candidateConstraints: number;
  inspectedPackages: number;
  transitiveHint: boolean;
}
export const TRILOGY_PREFLIGHT_LIMITS = Object.freeze({
  maxFiles: 2, maxFileBytes: 128 * 1024, maxTotalBytes: 256 * 1024,
  maxInstalledPackages: 96, maxConstraints: 12,
});
const safeWorkspace = (x: string): boolean =>
  x === '' || (x.length <= 120 && /^[A-Za-z0-9_.@/-]+$/.test(x) &&
    x.split('/').every(s => s !== '' && s !== '.' && s !== '..'));
const record = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x);
const result = (workspace: string, status: PreflightStatus, reason: string, n = 0, packages = 0, transitive = false): TrilogyPreflight =>
  ({ version: 1, mode: 'browser-preflight-only', status, reason, solverStatus: 'not-run',
    nativeSolversAvailable: false, workspace, candidateConstraints: n,
    inspectedPackages: packages, transitiveHint: transitive });

/** Preflight receives ONLY two same-workspace manifest/lock contents. */
export function inspectTrilogyCandidate(files: Pick<ProjectFile, 'path'|'content'|'isDirectory'>[], workspace = ''): TrilogyPreflight {
  if (!safeWorkspace(workspace) || !Array.isArray(files) || files.length > TRILOGY_PREFLIGHT_LIMITS.maxFiles) {
    return result('', 'unknown', 'Invalid workspace or input count.');
  }
  const pre = workspace ? workspace + '/' : '';
  const expected = [pre + 'package.json', pre + 'package-lock.json'];
  const map = new Map<string, string>();
  let totalBytes = 0;
  for (const f of files) {
    if (!f || f.isDirectory || typeof f.path !== 'string' || typeof f.content !== 'string' ||
        !expected.includes(f.path) || map.has(f.path)) return result(workspace, 'unknown', 'Unexpected/duplicate source path.');
    const bytes = new TextEncoder().encode(f.content).byteLength;
    if (bytes > TRILOGY_PREFLIGHT_LIMITS.maxFileBytes) return result(workspace, 'unknown', 'Source exceeds preflight file budget.');
    totalBytes += bytes;
    if (totalBytes > TRILOGY_PREFLIGHT_LIMITS.maxTotalBytes) return result(workspace, 'unknown', 'Source exceeds preflight transfer budget.');
    map.set(f.path, f.content);
  }
  if (!expected.every(x => map.has(x))) return result(workspace, 'unknown', 'Same-workspace manifest/lockfile missing.');
  let manifest: unknown, lock: unknown;
  try {
    manifest = JSON.parse(map.get(expected[0])!);
    lock = JSON.parse(map.get(expected[1])!);
  } catch { return result(workspace, 'unknown', 'Non-JSON evidence.'); }
  if (!record(manifest) || !record(lock) || ![2, 3].includes(lock.lockfileVersion as number) ||
      !record(lock.packages) || !record(lock.packages[''])) {
    return result(workspace, 'unknown', 'Lockfile shape/version unsupported.');
  }
  const rootDeps = manifest.dependencies;
  const lockedDeps = lock.packages[''].dependencies;
  if (!record(rootDeps) || !record(lockedDeps)) return result(workspace, 'skip', 'No explicit npm production dependency graph.');
  const packages = Object.entries(lock.packages);
  if (packages.length > TRILOGY_PREFLIGHT_LIMITS.maxInstalledPackages + 1) {
    return result(workspace, 'unknown', 'Installed-package preflight budget exceeded.');
  }
  if (packages.some(([path]) => path !== '' && (!path.startsWith('node_modules/') ||
    path.slice('node_modules/'.length).includes('/node_modules/')))) {
    return result(workspace, 'unknown', 'Nested/nonhoisted lock graph needs native review.');
  }
  const direct = Object.entries(rootDeps);
  if (!direct.length) return result(workspace, 'skip', 'No production dependencies.');
  if (direct.length !== Object.keys(lockedDeps).length ||
      direct.some(([name, range]) => lockedDeps[name] !== range)) {
    return result(workspace, 'unknown', 'Root manifest/lock mismatch.');
  }
  let n = 0;
  if (record(manifest.engines) && typeof manifest.engines.node === 'string') n++;
  let transitive = false;
  for (const [path, value] of packages) {
    if (path === '') continue;
    if (!record(value)) return result(workspace, 'unknown', 'Invalid lock package metadata.');
    if (record(value.engines) && typeof value.engines.node === 'string') n++;
    if (record(value.dependencies) && Object.keys(value.dependencies).length > 0) transitive = true;
    if (n > TRILOGY_PREFLIGHT_LIMITS.maxConstraints) {
      return result(workspace, 'unknown', 'Node requirement budget exceeded.', n, packages.length - 1, transitive);
    }
  }
  // A candidate is not a validated graph: the native pipeline checks exact
  // npm semver, reachability, trusted sources, and ALL solver evidence.
  if (n >= 2 && (transitive || n >= 3)) {
    return result(workspace, 'candidate', 'Bounded evidence may warrant an explicitly opted-in native Trilogy analysis; no browser proof is available.', n, packages.length - 1, transitive);
  }
  return result(workspace, 'skip', 'Fast deterministic reasoning is sufficient for this preflight; no external solver started.', n, packages.length - 1, transitive);
}
