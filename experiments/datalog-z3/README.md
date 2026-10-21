# UCE Souffle Datalog + Z3 (Node-only experiment)

This experiment is stacked on the existing Node-only Z3 PR #67.
**It is not deployed to UCE's website or browser and changes no production scoring.**

## How it works

The **real official Souffle Datalog 2.5** engine executes the fixed
'rules/reachability.dl' program, recursively deriving all reachable
installed npm packages from explicit production dependency facts.

Real **Z3 5.2.0 Node/WASM** then reasons about the 'engines.node'
requirements of reachable, locked packages and the root manifest.
For a modeled UNSAT answer, outputs include original package-lock
entry keys and root-to-package paths reconstructed from the verified edges.

All project source is treated as inert file data and never executed.
Only same-workspace 'package.json' and 'package-lock.json' are used.
Only v2/v3 hoisted-only npm production dependencies are modeled; aliases,
missing/mismatched ranges, nested copies, peer/optional/dev edges,
unsupported lock layouts, malformed input and over-budget files produce
UNKNOWN rather than incomplete formal proofs.

Safety limits: 32 input file records, 96 installed packages,
192 dependency edges, graph depth 16, 256 KiB per manifest and 12 Z3
constraints. Temporary Souffle facts are removed after analysis.
A conflict is only a **modelled Node requirement contradiction**,
not proof of runtime failure. Actual npm engine enforcement is not known.

## How to test on Ubuntu 24.04

CI downloads official pinned Souffle 2.5 Ubuntu 24.04 package and verifies
it against the upstream SHA512 manifest. After installing root UCE deps,
the isolated Z3 and Datalog experiment dependencies:

    npm --prefix experiments/datalog-z3 test
    npm --prefix experiments/datalog-z3 run demo
    npm --prefix experiments/datalog-z3 run benchmark

12 authored regression cases include transitive paths, unreachable
packages, invalid/missing lock evidence, cycles, cross-workspace
separation, optional dependencies and Souffle failure fallback.

The three-run benchmark is a process-level diagnostic, **not** an
independent human-reviewed real-world accuracy estimate or a browser
memory measurement.

## Gates before release

No browser/Web Worker integration, dependency-graph accuracy claims
or production score changes. Evaluate blinded real-project examples,
engine-strict semantics, resolution of nested/peer/aliased npm edges,
reproducible dependency locks, memory/time budget and security review
separately before considering wider adoption.

## Independent cvc5 SMT verifier — stacked experiment

This branch adds a **real native cvc5 1.1.2** verifier (Ubuntu 24.04
package version `1.1.2-1build1`) after Soufflé and Z3. This is **not**
a browser WASM build or deployment. To compare the same bounded facts:

    npm --prefix experiments/datalog-z3 test
    npm --prefix experiments/datalog-z3 run test:triple
    npm --prefix experiments/datalog-z3 run benchmark:triple

`cvc5.mjs` generates SMT-LIB QF_LIA equations for stable numeric
`engines.node` semver comparisons using the independently parsed same
requirements as Z3. No untrusted source/lockfile text is spliced into
SMT-LIB. The actual cvc5 CLI is spawned with a fixed argument array
and strict bounded stdin/stdout plus a wall-clock timeout.

`triple.mjs` uses the previously verified Soufflé reachability and
source-linked Z3 proof, then makes an independent cvc5 check. It
returns **only agreement** as confirmed modeled SAT/UNSAT. If either
solver is unavailable, returns `unknown`, times out, or disagrees,
the full triple result **abstains (Unknown)**. The original Z3 core
and root-to-dependency paths are retained only after independent
agreement; cvc5 does not independently certify the minimal source
explanation.

This comparison is an authored-fixture security and correctness
experiment, **not** independently adjudicated real-world accuracy.
High RSS, native cvc5 portability, npm engine-enforcement semantics,
lockfile edge cases and browser isolation still prohibit a production
rollout. No UCE findings, scoring, or default web behavior are changed.

## Optional Trilogy integration into a normal UCE analysis report

The Node-only adapter `optional-integration.mjs` now invokes the real
production `analyzeProject()` and, **only with `enableTrilogy: true`**,
adds a typed `report.optionalSolver` diagnostic plus a clearly marked
note when independently verified. Default browser and normal Node scans
do not load the native solver. The native `score`, `issues`,
`categories` and `stack.symbolicReasoning` remain unchanged.

A native solver is attempted only for a complete non-sampled same-workspace
npm v2/v3 hoisted dependency graph with 2–12 numeric Node engine
requirements **and** transitive dependencies or at least three
independent requirements. Simpler situations remain in UCE's fast
deterministic Phase 2 engine.

The native adapter validates the Z3/cvc5 agreement and original
unsatisfiable evidence against the lockfile graph again before attaching
a result. A worker error, disagreement, missing native binary, missing
lock evidence, truncated UCE scan, over-budget inputs or wall-clock
timeout produces `Unknown` without changing any existing finding.

The subprocess uses an 8-second default wall deadline, bounded input and
output, and best-effort Linux Node worker RSS sampling (512 MiB default).
On POSIX a deadline kills the worker's process **group** including
Soufflé and cvc5 subprocesses. Sampled Node-worker RSS is **not**
peak memory for the solver children and is not a hard total-memory limit.

Use this local-only opt-in CLI (requires Soufflé, Z3 and cvc5 installed):

```sh
npm --prefix experiments/datalog-z3 run demo:default
npm --prefix experiments/datalog-z3 run demo:optional
npm --prefix experiments/datalog-z3 run test:optional
```

The default report's `optionalSolver.status` is `disabled`.
The opted-in example reports a source-backed `conflict` without altering
UCE's compatibility rating. This is **experimental Node tooling**, not
a new web toggle or a remote report API. Production/browser integration
remains blocked until native/COOP/COEP and privacy constraints can be met,
and until independently adjudicated real repositories have been evaluated.

## Trilogy accuracy evaluation

See [Trilogy Accuracy Validation](../../docs/TRILOGY_ACCURACY_VALIDATION.md) for held-out authored semantic cases, metric definitions, provenance and independent human review gates. Run the audit:holdout script only with solver-equipped Node CI. No browser or compatibility-scoring changes.
