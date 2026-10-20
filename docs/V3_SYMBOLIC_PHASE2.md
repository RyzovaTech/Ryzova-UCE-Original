# UCE V3 Phase 2 — Evidence-backed Symbolic Reasoning

**Status:** targeted deterministic constraint reasoning pilot; **not** Z3, SMT,
whole-program symbolic execution, source-code runtime evaluation, or full dependency resolution.

## Scope and user-visible output

`evaluateSymbolicReasoning(files)` groups original source facts by **package directory**.
It returns per-comparison `conflict`, `satisfiable`, or `unknown`, with explicit
fact kind, source file, field/value, optional source line, explanation and recommendation.

The normal UCE browser/CLI `analyzeProject` pipeline attaches the structured
result to `stack.symbolicReasoning`, and exposes summary plus up to five
conflict explanations in the report notes. **Existing issues, scores, and CI
pass/fail thresholds are unchanged** in this first rollout: this avoids
double-counting the pre-existing version-correlation rules before independent
adjudication and UI validation.

The supported evidence pairs are:

| Domain | Independent, source-backed constraints | Conflict proof |
|---|---|---|
| Runtime | Same-workspace `package.json engines.node` and exactly one numeric line in `.nvmrc` or `.node-version` | Stable npm-style numeric version ranges have empty intersection |
| Dependency | Same-workspace `package.json` direct npm dependency range and `package-lock.json packages[node_modules/name].version` | Pinned numeric lock version lies outside declared numeric range |
| Configuration | Same-workspace `package.json type: module` and `tsconfig.json compilerOptions.module: CommonJS` | Explicitly configured emitting CommonJS in an ESM package; no `extends`, `noEmit` or declaration-only boundary |

Only direct package-local declarations are compared. Lockfiles from sibling
packages and scope-excluded test, vendor, generated, and documentation files do
not provide cross-package evidence. TypeScript JSONC permits comments/trailing
commas; arbitrary JavaScript config is never executed.

## Interpretation and accuracy boundaries

- `conflict` is a contradiction **within the modeled explicit constraints**;
  it does not prove that a particular application will fail at runtime. Build
  tooling, platform overrides, and framework transforms may change effective behavior.
- `satisfiable` means an intersection (or compatible syntax setting) exists,
  **not** that the project was tested or verified compatible.
- `unknown` means missing, malformed, dynamic, inherited, unsupported or
  insufficient evidence. No conflict is invented for an unknown source.
- Unsupported semver syntax (aliases, `workspace:*`, `latest`, prereleases),
  omitted lock entries, inherited TS config, and undetermined Node pins remain unknown.
- In this pilot, Dockerfile multi-stage runtime selections and indirect
  transitive dependencies remain outside the new symbolic comparison. The
  existing dedicated correlation checks continue to operate independently.

## Budgets and trust

The engine reads at most 20,000 project entries, 64 package manifests, 24 direct
dependencies per workspace, 256 output decisions, and 256 KiB of text per
modeled config. A capped comparison signals `limited: true`; no clean bill of
health is inferred from a limited analysis. Files are held only during the
current analysis; the solver performs no HTTP requests and executes no
project code.

## Validation

`npm run test:symbolic` runs authored positive, negative, workspace-isolation,
malformed-evidence, ambiguity, and budget tests on every pull request.
Full CI also runs typecheck, lint, Vite production build, UCE V3 rules,
security accuracy contracts, the sampled-project memory benchmark, and
existing package-local correlation tests.

**No independently human-adjudicated new cases have been collected by this
change.** Precision, recall, false-positive rate and browser-worker memory
impact must be measured on frozen real-project holdouts before expanding
the claim or adopting an optional Z3 constraint solver.
