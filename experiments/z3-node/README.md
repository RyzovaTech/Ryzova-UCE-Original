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
  `{ id, source, range }` declarations. Entries from sibling workspaces are
  rejected; unsupported/dynamic/prerelease constraints cause `unknown`.
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
npm install --no-audit --no-fund
npm install --prefix experiments/z3-node --no-package-lock --no-audit --no-fund
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

If the experiment proves accurate and cost-effective, the next step is an
evidence-to-constraint adapter that compares Z3 and the existing Phase 2
reasoner on frozen real projects **before** any end-user behavior changes.
