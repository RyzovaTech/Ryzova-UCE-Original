import { createHash } from 'node:crypto';
import semver from 'semver';
import { extractLockedDependencyGraph } from './graph.mjs';

// No native imports, binaries, module init, subprocesses, or project execution.
// Eligibility is about truthful scoped evidence, NOT size or UCE's original verdict.
const VALID_OPS = new Set(['', '=', '<', '<=', '>', '>=']);
function stableNumeric(range) {
  if (typeof range !== 'string' || !range.trim() || range.length > 160 ||
      /\d+\.\d+\.\d+-[0-9A-Za-z]/.test(range)) return false;
  try {
    const parsed = new semver.Range(range, { loose: false, includePrerelease: false });
    return parsed.set.length <= 8 && parsed.set.every(group => group.length <= 8 &&
      group.every(c => c.value === '' || (VALID_OPS.has(c.operator) &&
        c.semver && typeof c.semver === 'object' &&
        ['major', 'minor', 'patch'].every(k =>
          Number.isSafeInteger(c.semver[k]) && c.semver[k] >= 0 && c.semver[k] <= 1000000) &&
        (c.semver.prerelease.length === 0 ||
          (c.semver.prerelease.length === 1 && c.semver.prerelease[0] === 0)))));
  } catch { return false; }
}
export function inspectSmartEvidence(files, workspace = '') {
  const graph = extractLockedDependencyGraph(files, workspace);
  if (graph.status !== 'ok') return { eligible: false, status: 'unknown',
    reason: 'unsupported-or-incomplete-graph: ' + graph.reason, rules: ['D6'], graph: null,
    digest: null };
  const digest = createHash('sha256').update(JSON.stringify({
    workspace: graph.workspace,
    edges: [...graph.edges].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    constraints: [...graph.constraints].sort((a, b) => a.id.localeCompare(b.id)),
  })).digest('hex');
  if (graph.constraints.some(c => !stableNumeric(c.range))) {
    return { eligible: false, status: 'unknown', reason: 'unsupported-numeric-semver',
      rules: ['D6'], graph: null, digest };
  }
  // A single complete self-contradictory declaration is a meaningful proof
  // question; an ordinary single requirement is not a whole-project SAT proof.
  const selfContradiction = graph.constraints.length === 1 &&
    semver.minVersion(graph.constraints[0].range) === null;
  if (graph.constraints.length < 2 && !selfContradiction) {
    return { eligible: false, status: 'skipped', reason: 'no-supported-joint-question',
      rules: ['D10'], graph, digest };
  }
  if (graph.constraints.length > 32) {
    return { eligible: false, status: 'unknown', reason: 'eligible-but-over-solver-budget',
      rules: ['D8'], graph: null, digest };
  }
  const needsSouffle = graph.constraints.some(c => c.package !== '__uce_root__');
  return { eligible: true, status: 'eligible', reason: '',
    rules: [selfContradiction ? 'D3' : 'D2', ...(needsSouffle ? ['D4'] : [])],
    graph, digest, needsSouffle };
}
