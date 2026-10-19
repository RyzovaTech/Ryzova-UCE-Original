# UCE — 1000 additional public repositories: baseline results

**Audit date:** 2026-10-19  
**Reference scan:** [GitHub Actions #39193372653](https://github.com/RyzovaTech/Ryzova-UCE-Original/actions/runs/39193372653)  
**Source selection:** frozen 1000-project corpus in the workflow's `uce-1000-frozen-corpus` artifact; each source commit is in the per-shard records.  
**Relation to earlier study:** the previously scanned 160 repositories were excluded.

## Initial observed metrics (before follow-up detector improvements)

| Measured quantity | Result |
|---|---:|
| Repositories selected | 1000 |
| Repositories successfully analyzed | 999 |
| Clone/analysis failures | 1 |
| GitHub primary-language agreement | 937 / 998 (93.89%) |
| Explicit root package-manager marker agreement | 534 / 535 (99.81%) |
| Explicit root framework marker agreement | 13 / 14 (92.86%) |
| Scans reporting complete coverage | 900 / 999 |
| Scans reporting partial/budget-limited coverage | 99 / 999 |
| Repositories classified as nonsoftware | 17 |
| Repository-level label disagreements | 62 |

**These are observational agreement metrics, NOT independently reviewed true correctness, precision/recall, or total UCE compatibility/security accuracy.** Selection is biased toward small-to-medium popular public repositories, partitioned into 20 Github language/topic cohorts. GitHub Linguist differs in definition from UCE source identity, especially for polyglot repositories, templating, tutorials, docs-only trees, and generated code. Framework comparison has too few labeled projects to support broad inference.

## By search cohort — observed GitHub language agreement

| Cohort | Agreement |
|---|---:|
| C | 48/50 |
| C# | 49/50 |
| C++ | 36/50 |
| Dart | 49/50 |
| Elixir | 49/49 (one scan failure) |
| Go | 49/50 |
| Java | 42/50 |
| JavaScript general | 43/50 |
| JavaScript library | 46/50 |
| Kotlin | 43/49 |
| Lua | 49/50 |
| PHP | 49/50 |
| Python general | 46/50 |
| Python library | 49/50 |
| Ruby | 44/50 |
| Rust | 48/50 |
| Scala | 50/50 |
| Swift | 49/50 |
| TypeScript general | 49/50 |
| TypeScript library | 50/50 |

## Source-informed triage and follow-up commits

Several mismatches indicate potentially meaningful engine issues rather than merely the wrong GitHub label:

- C++ libraries with ordinary `.h` files containing `namespace` and `template<class T>` may be labeled C, because `.h` is a shared header extension. Follow-up change: require evidence of C++-specific syntax in those headers before mapping them to C++ instead of C. C-only headers should remain C.
- Go/Java/Swift source projects can have large HTML fixture/template files, which should not override actual source-language identity. Follow-up change: treat HTML and Jinja content as supporting when a substantive source language exists.
- `faif/python-patterns` has a root `Pipfile.lock`; its package-manager identity was previously reported as pip. Follow-up change: prioritize committed Pipenv lockfile evidence over generic PEP 621 pyproject metadata.

Regression tests were added for the above cases, with negative controls. These **code changes are after the measured 1000-project run** and have **not been measured against all 1000 again**. Do not publish an improved numerical agreement percentage until a fresh run of the same frozen SHA corpus is completed. GitHub CI test status must be checked before merge.

## Known limitations / next requirements

- Independently adjudicate a blind holdout of actual positive and negative technology/security/compatibility decisions.
- Review the exact 61 language-label differences in the per-shard artifacts; distinguish false positive, false negative, mixed-stack policy, docs-only classification and inaccurate external labels. Do not silently rewrite labels.
- Stratify partial scan coverage and log truncations. Do not count failed scans as correct negatives.
- Preserve GitHub source SHA, report coverage, raw outputs, source commit and selection metadata for reproduction.
- Verify live web app interaction separately; CI uses the shared UCE analyzer through the trusted CLI, not the website interface.

## Reproduction

In GitHub Actions open [UCE 1000 Public Repository Evidence Benchmark](https://github.com/RyzovaTech/Ryzova-UCE-Original/actions/workflows/uce-1000-accuracy.yml) and trigger a manual run. GitHub Actions saves each artifact for 30 days. The frozen input from the original baseline run must be reused for a strict before/after comparison; a fresh discovery run may produce a different set of repos.

See [TRIAGE-THREE.md](TRIAGE-THREE.md) for the previously disputed lowdb, clean-code-typescript, and wasmer-java sources.
