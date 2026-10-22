# Trilogy — Sequential Merge Readiness Gate

**Date:** 2026-10-22  
**Status:** CONDITIONAL / NOT YET PRODUCTION-READY. This is an evidence-based release checklist, not approval to merge.  
**Architecture:** optional local-first Node-only experiments. `analyzeProject()`, browser UCE scores/issues, source imports, and production dependencies remain unchanged.  
**PR chain:** #67 → #69 → #70 → #71 → #72. Documentation-only Phase 2 audit PR: #76. Phase 1 design PR: #75.

## Results verified at this checkpoint

- Automated review threads on the original PRs were triaged individually. Ten **additional** automated code-pattern threads appeared after the previous clean resolution and were also reviewed; thread state can change after further pushes.
- Experimental dependencies are locked using npm-generated registry integrity metadata, with `npm ci` in both workflows.
- Native processes run only in explicit opt-in Node experiments; subprocess arguments and environment are restricted and Linux RSS monitoring is async.
- CI has previously passed for each stage; each **new HEAD SHA requires its own final successful CI**. Do not re-use older success conclusions.
- A CI race `ESRCH` reading an exiting descendant from `/proc` was fixed in the process-tree regression test, but the corrected test must itself pass on final HEAD.
- **No independent blind human-labelled real-repository evaluation** or verified hard native process-tree memory limits have been produced. These cannot be claimed from the 40/40 frozen synthetic holdout.

## Gate matrix

| Gate | Pass condition | Current decision |
| --- | --- | --- |
| G1 Branch stack integrity | All five PRs retain incremental feature diffs, correct bases, no accidental edits to browser score/analyzer | Check after each final SHA, particularly after stacked merge |
| G2 Automated review | Zero untriaged unresolved findings; source-level response for newly generated alerts | Recheck after latest pushes |
| G3 CI | Complete UCE CI and appropriate Soufflé/Z3/cvc5 CI **success** on each final head SHA; no skipped required checks | Recheck |
| G4 Dependency reproducibility | `npm ci` on clean runner using committed Z3 and Datalog lockfiles, native binary provenance checks | Linux CI evidence only |
| G5 Hard memory/process-tree safety | Linux process-tree cgroup/approved equivalent enforced max memory, verified under adverse inputs and cancellation, with no uncontrolled descendants | **BLOCKED by #77** |
| G6 Platform support | Verified Windows Job Object or equivalent, macOS reaping/resource limits, or feature explicitly fails closed on unsupported platforms | **BLOCKED by #77** |
| G7 Evidence validity | Independent blind human-adjudicated pinned real repository cases; scoped TP/FP/FN/TN/Unknown with confidence intervals | **BLOCKED** |
| G8 Browser separation | Root bundle contains no native solver, no COOP/COEP changes, browser imports and scores unchanged | Preserve in every merge |
| G9 Maintainer approval | Human security/maintainer sign-off on remaining gates, licenses and feature rollout | **BLOCKED** |

## Explicit merge policy

**NO PRODUCTION MERGE of the stacked chain until all G1–G9 pass.** There is a narrower alternative decision, if maintainers explicitly approve it: merge **nonproduction, disabled-by-default experimental code only** with release feature gate and #77 still open; do not enable Trilogy for production or browser. This alternate merge requires documented owner approval and green final-head CI, and must not be represented as a production release.

After approval, merge sequentially:

1. #67 → `main`; revalidate root CI and ensure no web bundle import.
2. Retarget/rebase #69 onto updated `main` **without losing its Soufflé feature delta**; rerun CI and merge.
3. Repeat for #70 (cvc5) and #71 (optional report overlay), preserving default disabled status.
4. Merge #72 accuracy validation only after full CI and explicit interpretation limitations accepted.
5. Merge #76 documentation-only audit after its final review; merge #75 design documentation independently if approved.

Do not collapse multiple stacked diffs into a single unreviewed merge, force-push over others' work, assume GitHub's `mergeable` means secure, or reuse synthetic 40/40 as independent performance.

## Release verification artifacts required

- Exact commit SHA and workflow run links for each checked PR
- OS/kernel/Node/Soufflé/Z3/cvc5 versions
- Full native process-tree peak memory report and forced timeout/cancellation traces
- Complete teardown evidence on all supported platforms
- Real-world human-reviewed accuracy dataset protocol and per-case adjudication
- Locked dependency verification and binary provenance
- Sign-offs and a rollback/disabling plan

**Production UCE remains unchanged until signed off.**
