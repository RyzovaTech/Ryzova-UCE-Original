# Trilogy T3 — Independent Verification Safety Foundation

**Status:** staged on draft PR #93, opt-in Node-only source model validation. This is **NOT** the completed native Soufflé/Z3/cvc5 engine. T3 is divided into a verified safety foundation and native-execution acceptance still blocked by #77/#81.

## T3-A: implemented

- Consume the current UCE report and supplied local snapshot, **rederive** the T2 graph from source bytes rather than trusting caller-provided solver output. This does not cryptographically attest to the original scan revision.
- Compare graph reachability using two separately implemented, bounded deterministic algorithms (iterative BFS and DFS). Both must agree on reachable hashes of syntax-backed import relationships. This is **modeled graph consistency**, not independent detector accuracy.
- Opt-in explicitly: `verifyTrilogyModel(report, sourceFiles, {enabled:true, inventoryComplete:true, roots:['src/main.ts']})`. `enabled:false` results in `disabled`.
- Native Soufflé, Z3 and cvc5 are deliberately **NOT** invoked: a native request yields `unknown`, reason `hard-process-tree-isolation-and-real-native-solver-gates-not-met`; stages all `not-run`. An untrusted flag claiming isolation cannot bypass this.
- Incomplete scans, unreadable content, malformed input, dynamic unresolved import, missing entrypoint, graph truncation, timeout analogue or unsatisfied resource budget cannot be presented as a proven result. Original UCE score/issue data are not changed.
- Result stores SHA-256 source-path identity and bounded reachability digests, not raw project source text. Note that SHA-256 path hashes are **not anonymous** against known-path dictionary guessing.

## T3-B: mandatory before enabling real solvers

Existing experiments in historical PR #67/#69/#70/#71/#83/#86 include native Soufflé/Z3/cvc5 paths and strict Linux delegated-cgroup experiments. Merely porting and running them in CI or relying on process timeout and sampled RSS is **insufficient** for the T3 live safety gate.

- Explicit, auditable OS-enforced *entire process-tree* CPU/time/memory restrictions; Linux cgroup v2 with kernel-enforced OOM + verified descendant teardown, or tested Windows Job Object equivalent. No trusted hard isolation => `unknown`, do not spawn a native solver.
- Exact pinned source snapshot, input compatibility and scope agreement before solver invocation. Never send raw untrusted source code, paths or project commands into native solver executable arguments or SMT-LIB.
- Independent Soufflé reachability and real Z3/cvc5 semver constraint models must be run on admissible normalized facts, validating SAT witness/UNSAT evidence. Solver disagreement, timeout, crash, stdout overflow, memory exhaustion or uncertain cleanup => `unknown`.
- Independent real-world adjudicated false-positive/negative and recommendation correctness measurements before release (#80); realistic whole-process memory acceptance (#81); completed kernel-isolation gate (#77).
- Do not automatically promote graph agreements to UCE findings, score improvements, `Trilogy`/`Both` label, verified vulnerability or safe patches.

## Acceptance

```sh
npm ci
node --test testing/trilogy-t0/*.test.mjs testing/trilogy-t1/*.test.mjs testing/trilogy-t2/*.test.mjs testing/trilogy-t3/*.test.mjs
node testing/trilogy-t3/run.mjs --output=trilogy-t3-report.json
```

Dedicated workflow verifies T0–T3 contracts, frozen corpus, deterministic source-provenance output. Full UCE CI and CodeQL must pass on the **same** commit. No merge, manual production deployment, MCP publication or automatic fix.

**Accurate claim:** T3-A checks modeled graph consistency. Independent native Soufflé/Z3/cvc5 solver verification remains **not-run** and is an explicit release blocker, not a skipped success.
