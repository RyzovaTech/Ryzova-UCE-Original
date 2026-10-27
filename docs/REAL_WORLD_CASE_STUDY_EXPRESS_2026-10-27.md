# UCE Real-World Case Study #1 — Express.js (unreviewed source diagnostics)

**Date:** 2026-10-27  
**Project:** [expressjs/express](https://github.com/expressjs/express)  
**Pinned commit:** `1c6f1b0fe4000977b9a7b4f34097e4d527dd9824`  
**Scope:** Read-only public source snapshot and unreviewed UCE diagnostic output; **not** independently certified compatibility, security or accuracy. No upstream bugs have been confirmed.

## Reproducible headline

The [Phase 1 pilot run](https://github.com/RyzovaTech/Ryzova-UCE-Original/actions/runs/40441566480) scanned 216 indexed files at the pinned commit and emitted an original UCE overall score of **98**, with **7 raw signals** (0 critical, 1 warning, 6 informational). Its scan CLI printed `truncated:false`; the earlier derived diagnostic JSON incorrectly inferred `scanTruncated:true` from a missing optional report field. That discrepancy is a reporting-contract issue, **not** evidence that the original scan was truncated. The Phase 1 derived artifact therefore must not be treated as authoritative on scan coverage; fix this as `null` (Unknown) if no explicit report execution field exists.

[Additional Express source verification CI](https://github.com/RyzovaTech/Ryzova-UCE-Original/actions/runs/40453906097) reran the pinned scan and verified that the source file bytes underlying **2 of 7** raw signals matched the committed Git blob. The other 5 findings are not source-file pinned by this follow-up (they mostly concern absences or tree-wide properties). File-byte concordance **does not** establish finding correctness.

## What UCE reported vs what the pinned repository shows

| Raw UCE label | Severity | Source observation and important qualification |
|---|---|---|
| npm lockfile missing | Warning | No tracked npm lockfile in [pinned repository tree](https://github.com/expressjs/express/tree/1c6f1b0fe4000977b9a7b4f34097e4d527dd9824); `package.json` bytes pinned. A published library does not necessarily require a committed lockfile; no broken install proven. |
| No .env.example file found | Info | Not present among files in the pinned tree. A reusable web framework may not need environment-variable examples. |
| No Prettier configuration found | Info | No obvious Prettier config in pinned tree. Prettier is optional; absence is not a build failure. |
| No CONTRIBUTING.md found | Info | That named file is not in pinned tree. Contribution instructions might be maintained elsewhere; no contribution failure established. |
| Non-ASCII (Unicode) filenames detected | Info | Pinned tree contains `examples/downloads/files/CCTV大赛上海分赛区.txt` and `test/fixtures/snow ☃/.gitkeep`. This is a **real repository structure observation**, not evidence of platform breakage. |
| No SECURITY.md policy found | Info | Not in pinned repository tree; organization-level security policies can exist separately. No policy failure established. |
| package.json missing sideEffects field | Info | [Pinned `package.json`](https://github.com/expressjs/express/blob/1c6f1b0fe4000977b9a7b4f34097e4d527dd9824/package.json) has no `sideEffects` field. It is not universally mandatory, especially for a Node runtime library. No bundling malfunction proven. |

The source-file-linked findings are **lockfile** and **sideEffects** (both anchored to the same `package.json` with full-file SHA-256 `9645053f08f43135ec21f46ae434e49e10528c9062fde7776b150f38a2335afe`). The absence-based labels and tree-wide Unicode signal were additionally compared to the pinned Git tree for this write-up but were **not** independently adjudicated as technical defects.

## What experimental Trilogy added (and did not add)

In the Phase 1 diagnostic, Trilogy T2/T4 produced **138 source relationship observations**, of which **74 were Unknown**. The T1 source-review summary marked **2 source-referenced** UCE findings, **5 Unknown**, **0 independently checked literals**, and **0 confirmed cross-engine overlaps**. T4 was explicitly **review-only**; no original UCE issue was suppressed, no score was changed, no patch was applied. Trilogy relationship candidates are **not equivalent** to 138 additional bugs, and this trial did **not** run a human-ground-truth, paired detector accuracy experiment.

A source inventory of **166 selected source files** was used for the bounded T2/T4 review; **50 other files** from the 216-file checkout were not selected into this source-language subset. This does not prove full cross-file graph coverage. Separate CLI scan coverage and Trilogy analysis coverage must not be conflated.

## Why this is useful to a developer

UCE can raise concrete review questions and let a maintainer inspect actual pinned source evidence. The crucial engineering goal is distinguishing **source-observed facts** from **context-dependent recommendations** and **verified failures**. For example, the snapshot does show a missing lockfile; it does **not** prove that Express packaging or deployment fails. Unicode fixture filenames show a repository property; they do **not** prove a portability defect.

Developers can help by reproducing a signal, providing a minimal environment/version/command and expected-vs-observed behavior, or explaining why a rule should be scoped as optional for libraries. [Share feedback](https://github.com/RyzovaTech/Ryzova-UCE-Original/discussions/96) without exposing secrets or private source. [Volunteer for blinded review](https://github.com/RyzovaTech/Ryzova-UCE-Original/issues/94) if eligible.

## Evidence and release limits

- [Pinned upstream Express source tree](https://github.com/expressjs/express/tree/1c6f1b0fe4000977b9a7b4f34097e4d527dd9824)
- [Initial CI pilot](https://github.com/RyzovaTech/Ryzova-UCE-Original/actions/runs/40441566480)
- [Pinned finding metadata and source-link verification](https://github.com/RyzovaTech/Ryzova-UCE-Original/actions/runs/40453906097) — artifact `express-unverified-uce-finding-source-links`
- [Review protocol](TRILOGY_PHASE1_REAL_WORLD_PILOT.md)
- No authenticated independent human reference labels; no measured TP/FP/TN/FN or accuracy uplift; no claim that Express has seven confirmed defects. **Production release HOLD**; experimental Draft PR #93, no production activation.
