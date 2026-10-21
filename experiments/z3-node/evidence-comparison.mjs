import { load } from '../../scripts/trusted-module-loader.mjs';
import { solveNodeConstraints } from './solver.mjs';

const { evaluateSymbolicReasoning } = load('src/lib/symbolic/reasoner.ts');

/**
 * Reuses UCE's real production fact extraction rather than fabricating inputs
 * independently for Z3. Accepts only original same-workspace runtime facts.
 * This module runs in the isolated Node experiment, never the Vite bundle.
 */
export function prepareSharedRuntimeEvidence(files, workspace = '') {
  const report = evaluateSymbolicReasoning(files);
  const decisions = report.decisions.filter(d => d.domain === 'runtime' && d.workspace === workspace);
  const paths = new Set();
  const constraints = [];
  let incomplete = report.limited || decisions.length === 0;
  for (const result of decisions) {
    if (result.status === 'unknown' || result.facts.length !== 2) incomplete = true;
    for (const item of result.facts) {
      if (item.kind !== 'node-engine' && item.kind !== 'node-pin') continue;
      const path = item.file;
      if (paths.has(path)) continue;
      paths.add(path);
      // The existing AST/config detector reports .nvmrc value directly;
      // normalize only its explicit optional v prefix, never dynamic aliases.
      const value = item.kind === 'node-pin' ? item.value.replace(/^v(?=\d)/, '') : item.value;
      constraints.push({
        id: item.kind === 'node-engine' ? 'engine' : 'pin' + constraints.length,
        source: item.kind === 'node-engine' ? path + '#engines.node' : path + ':' + item.line,
        range: value,
      });
    }
  }
  if (constraints.length < 2) incomplete = true;
  const customStatus = !decisions.length || decisions.some(d => d.status === 'unknown') ? 'unknown'
    : decisions.some(d => d.status === 'conflict') ? 'conflict'
      : 'satisfiable';
  return {
    report,
    decisions,
    customStatus,
    constraints,
    workspace,
    complete: !incomplete,
    evidenceSources: constraints.map(c => c.source),
  };
}

export async function compareRuntimeEvidence(session, files, workspace = '', timeoutMs = 2000) {
  const prepared = prepareSharedRuntimeEvidence(files, workspace);
  const z3 = prepared.complete
    ? await solveNodeConstraints(session, { workspace, constraints: prepared.constraints }, timeoutMs)
    : { status: 'unknown', engine: 'Z3', reason: 'Production facts are absent, ambiguous, or truncated; refusing partial proof.', witness: null, unsatCore: [] };
  const disagreement = prepared.customStatus !== z3.status;
  const kind = !disagreement ? 'agreement'
    : prepared.customStatus === 'satisfiable' && z3.status === 'conflict' && prepared.constraints.length > 2
      ? 'joint-constraint-gap'
      : 'disagreement';
  const evidenceBySource = new Map(prepared.constraints.map(x => [x.source, x]));
  return {
    workspace, customStatus: prepared.customStatus, z3Status: z3.status,
    comparison: kind, z3, evidenceSources: prepared.evidenceSources,
    unsatExplanation: z3.status === 'conflict'
      ? z3.unsatCore.filter(x => evidenceBySource.has(x.source)).map(x =>
        ({ source: x.source, requirement: evidenceBySource.get(x.source).range, factId: x.id }))
      : [],
    guidance: z3.status === 'conflict'
      ? 'Inspect the exact same-workspace Node requirements in the listed sources. A modeled contradiction is not proof that the deployed runtime fails.'
      : z3.status === 'satisfiable'
        ? 'The declarations have a stable version witness; validate installation, target platform, and actual runtime separately.'
        : 'Review incomplete or unsupported declarations. Do not report a conflict without sufficiently supported evidence.',
    limited: prepared.report.limited,
  };
}
