import { extractLockedDependencyGraph } from './graph.mjs';
import { evaluateDatalogZ3 } from './hybrid.mjs';
import { solveWithCvc5 } from './cvc5.mjs';

/**
 * Evidence-preserving triple verification:
 *  1. Souffle derives exactly the reachable npm production dependencies.
 *  2. Z3 evaluates the numeric engine requirements and original UNSAT path.
 *  3. cvc5 independently checks the same normalized semver conjunction.
 *
 * If either SMT solver reports unknown or the solvers disagree, emit UNKNOWN,
 * never treat a single solver's conflict as independently verified.
 */
export async function evaluateDatalogZ3Cvc5(files, options = {}) {
  const primary = await evaluateDatalogZ3(files, { ...options, hoistedOnly: true });
  const unknown = (reason, cvc5Status = 'not-run', cvc5ElapsedMs = null) => ({
    engine: 'Souffle+Z3+cvc5', status: 'unknown', reason,
    z3Status: primary.status, cvc5Status,
    cvc5ElapsedMs, witness: null, unsatCore: [], paths: [],
    verification: 'incomplete',
  });
  if (primary.status === 'unknown') return unknown('Datalog/Z3 did not establish complete supported evidence: ' + primary.reason);
  const graph = extractLockedDependencyGraph(files, options.workspace ?? '', { hoistedOnly: true });
  if (graph.status !== 'ok' || graph.constraints.length < 2 || graph.constraints.length > 12) {
    return unknown('Original dependency evidence is missing or over budget.');
  }
  const independent = await solveWithCvc5(graph.constraints, {
    binary: options.cvc5Binary,
    wallMs: options.cvc5WallMs,
    solverMs: options.cvc5SolverMs,
  });
  if (independent.status === 'unknown') {
    return unknown('cvc5 could not independently verify the constraint system: ' + independent.reason,
      'unknown', independent.elapsedMs);
  }
  if (primary.status !== independent.status) {
    return unknown('The independent Z3/cvc5 SMT verdicts disagree; abstain and review semver modeling.',
      independent.status, independent.elapsedMs);
  }
  return {
    ...primary,
    engine: 'Souffle+Z3+cvc5',
    z3Status: primary.status,
    cvc5Status: independent.status,
    cvc5ElapsedMs: independent.elapsedMs,
    verification: 'independent-smt-agreement',
    reason: primary.reason + ' Independently confirmed on the same numeric constraints by cvc5.',
    limitation: 'An SMT declaration contradiction is not proof of npm engine enforcement, build failure, or application runtime incompatibility.',
  };
}
