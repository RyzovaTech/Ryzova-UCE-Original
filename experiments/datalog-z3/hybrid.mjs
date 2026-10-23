import { createZ3Session, solveNodeConstraints } from '../z3-node/solver.mjs';
import { extractLockedDependencyGraph } from './graph.mjs';
import { deriveReachability, dependencyPath } from './datalog.mjs';

const unknown = (reason, extras = {}) => ({
  engine: 'Souffle+Z3', status: 'unknown', reason, witness: null, unsatCore: [],
  paths: [], ...extras,
});

/**
 * Node/CLI-only experiment. Never influence production score or browser logic.
 * Derive complete hoisted npm graph reachability using real Soufflé Datalog;
 * pass original, same-workspace documented Node requirements to real Z3.
 */
export async function evaluateDatalogZ3(files, options = {}) {
  const graph = extractLockedDependencyGraph(files, options.workspace ?? '', { hoistedOnly: options.hoistedOnly === true });
  if (graph.status !== 'ok') return unknown(graph.reason, { stage: 'graph' });
  const derived = await deriveReachability(graph, options);
  if (derived.status !== 'ok') return unknown(derived.reason, { stage: 'datalog' });
  const reachable = new Set(derived.reachable);
  // Every dependency edge in this deliberately complete, bounded graph must
  // be reachable from the root. Otherwise the Datalog model is incomplete.
  if (graph.packages.some(p => !reachable.has(p))) {
    return unknown('Incomplete reachability derivation.', { stage: 'datalog' });
  }
  const facts = graph.constraints.filter(f => reachable.has(f.package));
  if (facts.length < 2 || facts.length > 12) {
    return unknown('Insufficient or over-budget Node requirements.', { stage: 'constraints' });
  }
  const constraints = facts.map(f => ({ id: f.id, source: f.source, range: f.range }));
  let session;
  try {
    session = await createZ3Session();
    const result = await solveNodeConstraints(session, {
      workspace: graph.workspace, constraints,
    }, options.solverTimeoutMs ?? 2000);
    if (result.status === 'unknown') return unknown(result.reason, { stage: 'z3' });
    if (result.status === 'satisfiable') return {
      engine: 'Souffle+Z3', status: 'satisfiable', witness: result.witness,
      reason: 'Modeled reachable dependency Node requirements have a common stable version; actual installation/runtime not verified.',
      unsatCore: [], paths: [], reachedPackages: derived.reachable.length,
    };
    const provenance = new Map(facts.map(f => [f.id, f]));
    const core = result.unsatCore.map(c => provenance.get(c.id))
      .filter(f => f && f.source === result.unsatCore.find(c => c.id === f.id)?.source);
    if (core.length < 2) return unknown('UNSAT core provenance could not be corroborated.', { stage: 'z3' });
    const paths = core.map(f => ({
      file: f.source.split('#')[0], field: f.key, range: f.range,
      package: f.package, dependencyPath: dependencyPath(graph, f.package),
    }));
    if (paths.some(p => !p.dependencyPath)) return unknown('UNSAT path evidence was not reconstructable.', { stage: 'datalog' });
    return {
      engine: 'Souffle+Z3', status: 'conflict', witness: null,
      reason: 'No stable numeric Node version satisfies all modeled requirements of these reachable production dependencies.',
      unsatCore: core.map(f => ({ id: f.id, source: f.source, key: f.key, range: f.range })),
      paths, reachedPackages: derived.reachable.length,
      warning: 'A modeled engines.node contradiction is NOT proof of installation failure unless npm engine enforcement and target environment are established.',
    };
  } catch {
    return unknown('Z3 subprocess could not be initialized or solved.', { stage: 'z3' });
  } finally {
    if (session) await session.close();
  }
}
