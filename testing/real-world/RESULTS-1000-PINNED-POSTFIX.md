# UCE V3 — Pinned 1000-repository post-fix and bounded evidence results

**Run date:** 2026-10-19  
**Previous baseline:** [run 39193372653](https://github.com/RyzovaTech/Ryzova-UCE-Original/actions/runs/39193372653)  
**Exact-source rerun:** [run 39195570482](https://github.com/RyzovaTech/Ryzova-UCE-Original/actions/runs/39195570482)

## Reproducibility protocol

Restored the original frozen 1000-repository discovery artifact and the complete original results (including per-project commit SHA) from the previous benchmark run. A new run required the **same commit SHA and original GitHub language label** for each previously successful scan. No source SHA mismatches or new pinned scan failures were reported. The single original failed project had no prior SHA, so it was retried but excluded from paired accuracy comparisons.

No downloaded third-party project code was executed; only the trusted UCE analysis CLI ran. Each source directory was deleted after inspection. All CI jobs, including 20 parallel source scans and result aggregation, passed.

## Before/after measurements at identical source revisions

| Measure | Original UCE baseline | UCE after language/tooling fixes | Difference |
|---|---:|---:|---|
| Source-SHA-paired successful scans | 999 | 999 | None |
| Language matches with frozen GitHub Linguist labels | 937/998 (93.89%) | **955/998 (95.69%)** | **+18 improved, 0 regressed** |
| Root package-manager evidence matches | 534/535 (99.81%) | **535/535 (100%)** | **+1 improved, 0 regressed** |
| Root framework marker matches | 13/14 (92.86%) | 13/14 (92.86%) | Unchanged |
| Reports with complete coverage recorded | 900/999 | 900/999 | None |
| Reports with partial/budget-limited coverage | 99/999 | 99/999 | None |
| Project scan failures | 1/1000 | 1/1000 | Original failure not in paired denominator |

By cohort, **C++ label agreement went from 36/50 (72%) to 45/50 (90%)**, and **Go from 49/50 (98%) to 50/50 (100%)**. Overall 43 language-label disagreements remain. Review them by reading real source; GitHub Linguist is an imperfect label and changing the detector to match every label can harm accuracy.

These percentages are **observational agreement**, **not confirmed true project classification accuracy**, and do not measure security, compatibility, vulnerability exploitability, deployment correctness or the validity of the 10,000 rule corpus.

## Security and browser-compatibility decision evaluation (bounded, provisional)

In the same run a separate diagnostic evaluated 25 pre-existing agent-labelled security cases from pinned source excerpts/synthetic controls, and 17 agent-authored browser-version/API positive/negative controls.

| Diagnostic area | TP | FP | FN | TN | Precision | Recall | False-positive rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| Selected security evidence decisions (25) | 10 | 0 | 0 | 15 | 100% | 100% | 0% |
| Browser API/version controls (17) | 7 | 3 | 0 | 7 | 70% | 100% | 30% |

Browser diagnostic false positives: `comment-webgpu-old`, `string-webgpu-old`, and `css-comment-has`. These were separately investigated and addressed via source/comment filtering in [PR #60](https://github.com/RyzovaTech/Ryzova-UCE-Original/pull/60). **The table above predates that separate fix.**

### Crucial limitations

- **Independently human-adjudicated cases: 0**. All security/browser claims here are `agent-provisional`; no independent third-party review has verified them.
- This is **NOT** the sensitivity/specificity of UCE over 1000 real repositories. The 1000 repos did **not** come with human-labeled security and compatibility decisions.
- Security labels indicate whether a static warning pattern should be surfaced, not whether a real exploitable security vulnerability exists.
- Browser controls use rule-version expectations and static source checks; no live browser runtime testing occurred.
- Small conditional denominators yield wide confidence intervals (security precision 95% Wilson approx 72–100%; browser precision 95% Wilson approx 40–89%). Zero observed FP is not proof of zero real-world false positives.
- A credible independent precision/recall study requires a **blind holdout** with separately reviewed positive and negative decisions, published annotation guidelines, source SHAs, disagreement adjudication and no detector tuning against holdout labels.

### Reproduce

Workflow: [UCE Exact-Pinned 1000 Rerun and Evidence Precision](https://github.com/RyzovaTech/Ryzova-UCE-Original/actions/workflows/uce-pinned-1000-evidence.yml). It is manual-only after the initial successful run, to avoid repeated 1000-repository scans on ordinary PRs.

Artifacts from run 39195570482 hold per-repository outputs, pinned-source comparisons and the provisional diagnostic records. Artifacts expire after their retention period; this summary preserves the overall measurements.
