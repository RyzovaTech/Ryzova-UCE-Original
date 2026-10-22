# Z3 Node/CLI proof of concept — experimental

**Status: branch-only experiment.** This directory is deliberately excluded
from the Vite/React analyzer and browser Web Worker. It does not alter the UCE
compatibility score, current Phase 2 decisions, or production release.

## Why test Z3?

UCE already extracts original evidence from manifests, workspace boundaries,
runtime selectors and config files. Z3 is a proven SMT solver that can test
**many simultaneous logical constraints** and produce an *unsatisfiable core*.
This proof of concept evaluates runtime version constraints as
`Node major/minor/patch` integers in one Z3 context.

- The isolated package pins `z3-solver@5.2.0` (MIT) and
  `semver@7.8.5` (ISC), without adding either package to the root
  browser runtime dependency tree.
- Node 20–24 loads Z3 WASM via the npm Node binding; `killThreads`
  shuts down background solver workers before CLI exit.
- The structured input has `workspace` and 1–12 independently sourced
  `{ id, source, range }` declarations. The empty workspace selects **root only**, not
  all nested packages. Source references must be canonical same-directory
  paths with an optional `#field` or `:line` marker; cross-workspace,
  non-canonical and traversing paths are rejected as `unknown`.
  Unsupported/dynamic/prerelease constraints also cause `unknown`.
- An SMT conjunction combines each package, CI, runtime-pin or image
  requirement. `sat` yields a stable numeric witness validated by the
  original npm semver ranges. `unsat` yields a non-necessarily-minimal
  unsatisfiable core mapped back to source facts.
- Version components and solver time are bounded. Solver `unknown`,
  malformed evidence and unsupported syntax are never treated as safe or
  proven conflicts.

## Run locally

From the repository root:

```sh
npm ci --no-audit --no-fund
npm ci --prefix experiments/z3-node --no-audit --no-fund
npm --prefix experiments/z3-node test
node experiments/z3-node/cli.mjs experiments/z3-node/fixtures/runtime-conflict.json
```

The CLI outputs a JSON record with `status`, `witness` (only on SAT) and
`unsatCore` (only on UNSAT). A conflict is a successfully computed result
and has exit code 0. Unknown returns exit 3; malformed inputs or loader
failures return exit 2.

To measure the Node-only experimental WASM initialization and solving costs:

```sh
npm --prefix experiments/z3-node run benchmark
```

The result records cold initialization, first and warm solves, and process RSS.
It is diagnostic, dependent on the runner, and **not** a browser performance
or real-project accuracy measurement. A three-constraint case also proves
joint UNSAT where all three pairwise intersections remain nonempty.

The GitHub CI workflow installs the isolated experiment dependencies and
runs the real Node/WASM Z3 tests. These tests also compare supported
two-range examples against UCE's existing deterministic constraint helper.

## What it does NOT establish

- Z3 never reads or executes project code here, and this PoC does not
  automatically infer constraints from a repository or lockfile.
- The witness is only a **mathematical Node version** satisfying all
  explicitly supplied supported declarations. No actual runtime, dependency
  installation, build, or deployment is tested.
- The UNSAT core is a subset of contributing constraints, not necessarily
  the smallest explanation or proof that the application crashes.
- Broader npm constraints, prereleases, peer dependency graphs, environment
  variables and TypeScript output configuration remain future work.
- These are authored regression tests, **not** independently reviewed
  compatibility precision/recall.
- No browser WASM or COOP/COEP headers are deployed. Browser integration
  needs a separate risk/size/security study and an explicit rollout.

## Real UCE evidence parity and UCE-specific tuning (21 October 2026)

The optional Node-only `evidence-comparison.mjs` imports the **production UCE
symbolic evidence extractor** via the existing trusted TypeScript module loader.
It passes exactly the same same-workspace original `package.json engines.node`,
`.nvmrc` and `.node-version` source facts to both engines, without reading
or running untrusted project code in Z3. Unknown, unsupported, missing or
truncated facts block a partial Z3 proof; an UNSAT source explanation includes
the exact source ID and range. A `satisfiable` result is not real-world runtime
compatibility. A source pin is a declared selection, not proof of enforcement.

Run the authored, labeled comparison and the full bounded resource audit:

```sh
npm --prefix experiments/z3-node run validate:evidence
npm --prefix experiments/z3-node run audit
npm --prefix experiments/z3-node run browser:gate
```

- `validation.mjs`: 20 static authored positive, negative and incomplete
  fixtures, including nested workspace boundaries and a joint 3-constraint
  conflict that pairwise checks miss. The output records the explicit
  **custom vs Z3 disagreements**, expected labels, authored-only confusion
  counts and false-conflict counts. It tests facts extracted by production
  UCE, not a second hand-written fact parser.
- `audit.mjs`: per-run initialisation, first-solve and 10 warm-solve samples,
  full labeled-matrix time, RSS/heap/JS external memory snapshots, configured
  bounded solver time, reported unknowns and the number of authored false
  conflicts. CI attaches `experiments/z3-node/metrics/latest-audit.json`
  as `uce-z3-node-audit`. This JSON is excluded from commits.
- A configured solver timeout is **not** a real wall-clock kill guarantee.
  An invalid budget must return unknown, but a genuine timed-out hard
  Z3 problem has not been demonstrated unless the measured audit says so.
- A disagreement due to **joint unsatisfiability** is recorded as a
  `joint-constraint-gap`; it is not silently asserted to be a custom false
  positive or evidence of overall user-facing accuracy.
- False-positive numbers refer **only to these authored fixtures**. An
  independent, blinded real-project adjudication is still mandatory.

## Browser production gate — blocked until independently demonstrated

`browser-gate.mjs` inspects the root `vercel.json` and runtime dependencies
without modifying either. It deliberately records a **blocked** status when
COOP/COEP and actual browser worker loading/memory/ZIP-import tests have not
been demonstrated. COOP/COEP static headers by themselves are **not**
sufficient; `Cross-Origin-Embedder-Policy` can block ZIP import,
GitHub archive rewrites, or third-party resources. Do not change production
headers or import Z3 into Vite until a separate browser test deployment proves:

1. Chrome/Firefox actual isolated-worker Z3 WASM cold init and constrained solve.
2. No build-time main-bundle growth; worker lazy load only when requested.
3. Measured peak worker memory/latency, cancellation and strict timeouts.
4. ZIP upload, GitHub codeload/archive path, accessibility and CSP regressions.
5. A robust deterministic-engine fallback if WASM fails, times out or exceeds
   the memory budget.

**Node-only experiments remain unmerged. No production score, detection rules,
web-worker imports, deployment headers or app version have been changed.**


## Opt-in Hybrid UCE Node runner

`hybrid.mjs` combines UCE's **actual production symbolic evidence extraction**
with a short-lived, bounded Z3 child process. This is an *experimental opt-in
Node/CLI entry point*, not an import in the web analyzer. By default only the
original native reasoner runs. Even with `enableZ3: true`, Z3 is consulted
only for **three or more complete explicit runtime constraints** within the
same package workspace; simpler checks use the existing engine.

```sh
npm --prefix experiments/z3-node run hybrid
node experiments/z3-node/hybrid-cli.mjs experiments/z3-node/fixtures/hybrid-joint.json
node experiments/z3-node/hybrid-cli.mjs experiments/z3-node/fixtures/hybrid-joint.json --z3
```

The experimental overlay keeps `base` decisions and scores unmodified.
On supported jointly unsatisfiable runtime declarations, `effectiveStatus`
can become `conflict` with an original source-linked UNSAT explanation.
Solver `unknown`, incomplete metadata, malformed output, invalid resource
budgets, worker timeout, excessive sampled Linux RSS or process exit **all
preserve the native result**. The parent never imports Z3 or keeps its WASM
alive between analyses.

Current guards: max 12 facts, 16KiB serialized worker request,
2s Z3 solver-time setting, 5s default child wall-clock deadline and
512MiB default sampled child RSS limit (Linux only). These are experimental
resource guards, **not formal process-memory enforcement on all operating
systems**, and do not make browser startup/COOP/COEP safe. Do not deploy
this as a long-running service or merge it into the web Worker until a
separately reviewed browser test and independent real-project labels pass.

Test via `npm --prefix experiments/z3-node test`. The tests exercise the
real Z3 WASM child, timeout-kill, RSS-kill, fallback and preserved source
provenance. All UCE compatibility scoring remains unchanged.
