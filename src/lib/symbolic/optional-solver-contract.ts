/** Node-only, opt-in, evidence-only Trilogy solver overlay. Browser scans omit this field. */
export interface OptionalTrilogySolverDiagnostic {
  version: 1;
  engine: 'Souffle+Z3+cvc5';
  enabled: boolean;
  attempted: boolean;
  workspace: string;
  status: 'disabled' | 'skipped' | 'unknown' | 'conflict' | 'satisfiable';
  verification: 'not-run' | 'independent-smt-agreement';
  reason: string;
  evidence: Array<{ file: string; field: string; range: string; dependencyPath: string[] }>;
  unsatCore: Array<{ id: string; source: string; key: string; range: string }>;
  witness: string | null;
  runtimeMs: number | null;
  sampledNodeWorkerRssMiB: number | null;
  limitations: string[];
}
