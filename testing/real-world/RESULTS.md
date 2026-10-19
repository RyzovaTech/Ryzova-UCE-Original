# UCE V3 — 160 public repository observational benchmark

**Date:** 2026-10-19  
**Engine:** 3.0.0-beta.1 with accuracy-stabilization changes  
**Source list:** [repositories.json](repositories.json)  
**Runner:** [scan-benchmark.mjs](scan-benchmark.mjs)  
**GitHub Actions:** [initial evaluation](https://github.com/RyzovaTech/Ryzova-UCE-Original/actions/runs/39190233878) · [post-fix complete evaluation](https://github.com/RyzovaTech/Ryzova-UCE-Original/actions/runs/39191347296)

## Measured agreement — not an accuracy guarantee

| Measure | Before code fixes | After code fixes |
|---|---:|---:|
| Selected public repositories | 160 | 160 |
| Repositories cloned and analyzed | 160 | 160 |
| GitHub primary-language agreement | 156 / 160 (97.50%) | 157 / 160 (98.13%) |
| Root package-manager marker agreement | 123 / 124 (99.19%) | 124 / 124 (100.00%) |
| Root framework marker agreement | 2 / 2 (100%) | 2 / 2 (100%) |
| Reports without a recorded coverage limitation | 140 / 160 | 140 / 160 |
| Clone/scan failures | 0 | 0 |

No public repository source was executed. UCE's trusted CLI analyzed locally cloned source trees. Per-project metadata, commit SHAs, observed detection outputs and sampling/coverage flags are in the workflow artifacts, which are retained for 14 days.

**Important:**
- Agreement with GitHub Linguist's primary language is **not** independently adjudicated project identity.
- Marker labels are based on unambiguous root lock/manifests; absent or ambiguous signals are excluded from their denominators.
- 20 runs had UCE-recorded partial coverage. Those repositories are still in the raw agreement denominator and should be stratified before conclusions.
- This evaluation does not establish project-wide precision/recall or validity of 10,000 V3 rule findings, security vulnerabilities, runtime compatibility, browser behavior, licensing, or deployment readiness.
- The sample is selected and relatively small per ecosystem (20 per group), not random; a percent is descriptive only.

## Real-project regressions fixed

1. **fathyb/carbonyl** (pinned at `ab80a276b1bd1c2c8dcefc8f248415dfc61dc2bf`): root `Cargo.toml` + metadata-only `package.json` previously yielded npm. Now yields cargo. Meaningful npm scripts/dependencies and explicit npm locks still retain npm priority.
2. **inversify/InversifyJS** (pinned at `fdd9186891e777884012984c64c271e576155f08`): root `tsconfig.json`, first-party `src/index.ts` and large JavaScript tooling previously yielded JavaScript. Now yields TypeScript without requiring multiple TypeScript entry files.

These fixes have independent regression fixtures in `testing/accuracy/stack-regressions.test.mjs`, including negative cases. GitHub CI passed and post-fix real-repo runs reproduced both improvements.

## Three remaining language-label differences

| Repository (evaluated commit) | GitHub language label | UCE output | Interpretation |
|---|---|---|---|
| [typicode/lowdb](https://github.com/typicode/lowdb/tree/8a6fce9b72f769b22533f0979fbc2e73180f8112) | JavaScript | TypeScript | Source includes root `tsconfig.json` and production TypeScript; GitHub label alone is not proof of an engine defect |
| [labs42io/clean-code-typescript](https://github.com/labs42io/clean-code-typescript/tree/05a25e8fb8f4cdca4e6cfbddd60323c6ddc5aa54) | TypeScript | YAML | Primarily technical writing / documentation with configuration files; language metric not a reliable software-code oracle |
| [wasmerio/wasmer-java](https://github.com/wasmerio/wasmer-java/tree/cbd3ac5b3de83b5abab12361614ea982f6a30d79) | Java | Rust | Polyglot Java API plus native Rust/JNI library; primary-language policy needs separately defined expectations |

**Do not silently alter engine classification or benchmark labels merely to remove these differences.** Broader source-level evidence and explicit mixed-stack identity policy are needed.

## Reproduction

Open [UCE 160 Real Repository Benchmark](https://github.com/RyzovaTech/Ryzova-UCE-Original/actions/workflows/uce-realworld-accuracy.yml) in GitHub Actions and select **Run workflow**. It uses four parallel shards, bounded CLI scans (4,000 files / 16 MiB of content), shallow clones and deterministic source selection. Re-runs may scan newer commits; compare each stored SHA when assessing changes.

A globally meaningful 95% precision/recall claim still requires independently human-reviewed per-module decisions on full project boundaries and a blind holdout evaluation, per [accuracy release validation](../../docs/ACCURACY_90_95_PHASE5.md).
