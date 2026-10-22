# Phase 2 — Review-thread security triage (26 original alerts)

**Audit date:** 2026-10-22. **Scope:** experimental PRs #67, #69, #70, #71. Source inspected on the current stacked head `f28cbeb`; not an independent external security assessment. **Production: NO-GO.**

These are **26 separately examined automatic GitHub Advanced Security review comments**, not 26 confirmed vulnerabilities. Classification distinguishes actual remediation from context-accepted patterns and unresolved release blockers. None should be marked resolved on an upstream PR until the decision is accepted there and any required patch is propagated and re-tested.

## Counts
- FALSE_POSITIVE: 3
- LOCAL_CLI_OUTPUT_REVIEW: 2
- BENIGN_AUTHORED_DIAGNOSTIC: 6
- BENIGN_NONREQUEST_SCRIPT: 2
- PATCHED_REVIEW_BRANCH: 3
- HARDENING_GATE_OPEN: 4
- DEFENSIVE_TIMER_WITH_OPEN_RESOURCE_GATE: 6

## Individual finding dispositions

| PR | GitHub alert | Source | Disposition | Evidence / follow-up |
| --- | --- | --- | --- | --- |
| #67 | [181](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/181) | `experiments/z3-node/solver.mjs:170` | `FALSE_POSITIVE` | Z3 AST/model API invocation, not JavaScript eval or Function construction; manually verified solver.mjs lines 170-172. No dynamic user-code execution at this site. |
| #67 | [182](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/182) | `experiments/z3-node/solver.mjs:171` | `FALSE_POSITIVE` | Z3 AST/model API invocation, not JavaScript eval or Function construction; manually verified solver.mjs lines 170-172. No dynamic user-code execution at this site. |
| #67 | [183](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/183) | `experiments/z3-node/solver.mjs:172` | `FALSE_POSITIVE` | Z3 AST/model API invocation, not JavaScript eval or Function construction; manually verified solver.mjs lines 170-172. No dynamic user-code execution at this site. |
| #67 | [180](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/180) | `experiments/z3-node/cli.mjs:19` | `LOCAL_CLI_OUTPUT_REVIEW` | Explicit local CLI stdout/usage, not backend logging. Phase 2 patch additionally redacts unexpected JSON-parser error messages. Confirm outputs are documented and opt-in; avoid uploading private-project output artifacts. |
| #67 | [186](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/186) | `experiments/z3-node/benchmark.mjs:33` | `BENIGN_AUTHORED_DIAGNOSTIC` | Log is authored-fixture/CI-only benchmark, validation, static gate or explicit local diagnostic output; no untrusted project contents echoed on this path. Keep log disclosure documented. |
| #67 | [191](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/191) | `experiments/z3-node/audit.mjs:91` | `BENIGN_NONREQUEST_SCRIPT` | Synchronous filesystem access occurs in standalone CI audit or static browser-gate tool, never the web/worker request path; consider future ergonomic refactor but not production security blocker. |
| #67 | [189](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/189) | `experiments/z3-node/browser-gate.mjs:7` | `BENIGN_NONREQUEST_SCRIPT` | Synchronous filesystem access occurs in standalone CI audit or static browser-gate tool, never the web/worker request path; consider future ergonomic refactor but not production security blocker. |
| #67 | [190](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/190) | `experiments/z3-node/audit.mjs:92` | `BENIGN_AUTHORED_DIAGNOSTIC` | Log is authored-fixture/CI-only benchmark, validation, static gate or explicit local diagnostic output; no untrusted project contents echoed on this path. Keep log disclosure documented. |
| #67 | [188](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/188) | `experiments/z3-node/browser-gate.mjs:34` | `BENIGN_AUTHORED_DIAGNOSTIC` | Log is authored-fixture/CI-only benchmark, validation, static gate or explicit local diagnostic output; no untrusted project contents echoed on this path. Keep log disclosure documented. |
| #67 | [187](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/187) | `experiments/z3-node/validation.mjs:86` | `BENIGN_AUTHORED_DIAGNOSTIC` | Log is authored-fixture/CI-only benchmark, validation, static gate or explicit local diagnostic output; no untrusted project contents echoed on this path. Keep log disclosure documented. |
| #67 | [196](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/196) | `experiments/z3-node/hybrid-cli.mjs:13` | `PATCHED_REVIEW_BRANCH` | Replaced synchronous /proc RSS reads with nonoverlapping async polling or changed local CLI file load to async; regression CI still required; upstream PR thread stays open until ported. |
| #67 | [197](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/197) | `experiments/z3-node/hybrid.mjs:31` | `PATCHED_REVIEW_BRANCH` | Replaced synchronous /proc RSS reads with nonoverlapping async polling or changed local CLI file load to async; regression CI still required; upstream PR thread stays open until ported. |
| #67 | [195](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/195) | `experiments/z3-node/hybrid.mjs:41` | `HARDENING_GATE_OPEN` | Process uses spawn with explicit argument array (Node defaults to shell:false, cvc5 explicitly disables shell). Path comes from trusted opt-in experiment config, not parsed source; require complete descendant cleanup, environment isolation, and platform budget verification before merge. |
| #67 | [194](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/194) | `experiments/z3-node/hybrid-cli.mjs:30` | `LOCAL_CLI_OUTPUT_REVIEW` | Explicit local CLI stdout/usage, not backend logging. Phase 2 patch additionally redacts unexpected JSON-parser error messages. Confirm outputs are documented and opt-in; avoid uploading private-project output artifacts. |
| #67 | [198](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/198) | `experiments/z3-node/hybrid.mjs:66` | `DEFENSIVE_TIMER_WITH_OPEN_RESOURCE_GATE` | Timer/interval intentionally enforce time/RSS budgets and are cleared on completion, not an unsafe feature alone. Full process-tree reaping/memory enforcement remains an open release gate. |
| #67 | [199](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/199) | `experiments/z3-node/hybrid.mjs:67` | `DEFENSIVE_TIMER_WITH_OPEN_RESOURCE_GATE` | Timer/interval intentionally enforce time/RSS budgets and are cleared on completion, not an unsafe feature alone. Full process-tree reaping/memory enforcement remains an open release gate. |
| #69 | [201](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/201) | `experiments/datalog-z3/datalog.mjs:22` | `HARDENING_GATE_OPEN` | Process uses spawn with explicit argument array (Node defaults to shell:false, cvc5 explicitly disables shell). Path comes from trusted opt-in experiment config, not parsed source; require complete descendant cleanup, environment isolation, and platform budget verification before merge. |
| #69 | [200](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/200) | `experiments/datalog-z3/benchmark.mjs:19` | `BENIGN_AUTHORED_DIAGNOSTIC` | Log is authored-fixture/CI-only benchmark, validation, static gate or explicit local diagnostic output; no untrusted project contents echoed on this path. Keep log disclosure documented. |
| #69 | [204](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/204) | `experiments/datalog-z3/datalog.mjs:27` | `DEFENSIVE_TIMER_WITH_OPEN_RESOURCE_GATE` | Timer/interval intentionally enforce time/RSS budgets and are cleared on completion, not an unsafe feature alone. Full process-tree reaping/memory enforcement remains an open release gate. |
| #70 | [208](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/208) | `experiments/datalog-z3/cvc5.mjs:116` | `HARDENING_GATE_OPEN` | Process uses spawn with explicit argument array (Node defaults to shell:false, cvc5 explicitly disables shell). Path comes from trusted opt-in experiment config, not parsed source; require complete descendant cleanup, environment isolation, and platform budget verification before merge. |
| #70 | [207](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/207) | `experiments/datalog-z3/benchmark-cvc5.mjs:15` | `BENIGN_AUTHORED_DIAGNOSTIC` | Log is authored-fixture/CI-only benchmark, validation, static gate or explicit local diagnostic output; no untrusted project contents echoed on this path. Keep log disclosure documented. |
| #70 | [210](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/210) | `experiments/datalog-z3/cvc5.mjs:130` | `DEFENSIVE_TIMER_WITH_OPEN_RESOURCE_GATE` | Timer/interval intentionally enforce time/RSS budgets and are cleared on completion, not an unsafe feature alone. Full process-tree reaping/memory enforcement remains an open release gate. |
| #71 | [212](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/212) | `experiments/datalog-z3/optional-integration.mjs:40` | `PATCHED_REVIEW_BRANCH` | Replaced synchronous /proc RSS reads with nonoverlapping async polling or changed local CLI file load to async; regression CI still required; upstream PR thread stays open until ported. |
| #71 | [211](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/211) | `experiments/datalog-z3/optional-integration.mjs:51` | `HARDENING_GATE_OPEN` | Process uses spawn with explicit argument array (Node defaults to shell:false, cvc5 explicitly disables shell). Path comes from trusted opt-in experiment config, not parsed source; require complete descendant cleanup, environment isolation, and platform budget verification before merge. |
| #71 | [214](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/214) | `experiments/datalog-z3/optional-integration.mjs:81` | `DEFENSIVE_TIMER_WITH_OPEN_RESOURCE_GATE` | Timer/interval intentionally enforce time/RSS budgets and are cleared on completion, not an unsafe feature alone. Full process-tree reaping/memory enforcement remains an open release gate. |
| #71 | [215](https://github.com/RyzovaTech/Ryzova-UCE-Original/security/code-scanning/215) | `experiments/datalog-z3/optional-integration.mjs:85` | `DEFENSIVE_TIMER_WITH_OPEN_RESOURCE_GATE` | Timer/interval intentionally enforce time/RSS budgets and are cleared on completion, not an unsafe feature alone. Full process-tree reaping/memory enforcement remains an open release gate. |

## Verified remediation on isolated Phase 2 branch

- `experiments/z3-node/cli.mjs`: do not echo unexpected exception/JSON parser text, which may contain user-supplied source snippets.
- `experiments/z3-node/hybrid-cli.mjs`: async local input loading, redact parser errors.
- `experiments/z3-node/hybrid.mjs` and `experiments/datalog-z3/optional-integration.mjs`: asynchronous, nonoverlapping `/proc` RSS polling with settled/finished guard; no `readFileSync` on 25-ms request-time sampling timer.

**Notes:** These changes do **not** prove hard native process-tree memory enforcement, full cross-platform child termination, trusted external binary path policy, or real-world accuracy. Those remain separate release gates under Phase 1 contract. All original thread states should stay open until reviewers accept dispositions and patched commits are carried into corresponding stacked PRs.

## Dependency reproducibility gate

`experiments/z3-node/package.json` pins top-level semver/Z3 versions but the old workflow used `npm install --no-package-lock`; `experiments/datalog-z3` also uses `--no-package-lock`. Phase 2 must commit lockfiles generated from actual registry resolutions with integrity metadata, use `npm ci` without fallback to `npm install`, and execute clean-install CI before asserting this gate closed. Do **not** hand-author integrity metadata or claim resolution reproducibility based on top-level pinning alone.

## Required Phase 2 exit gate

1. 26 individual findings categorized; replies and resolutions verified in each original PR.
2. Confirmed data exposure and synchronous request-path issues patched and regression-tested.
3. Isolated npm lockfiles committed and cold `npm ci` validated on CI; official native Soufflé/cvc5 packages provenance reviewed.
4. Full production UCE CI, Trilogy CI, input/timeout/fallback tests pass on final integrated branch SHAs.
5. Reviewer approval of still-open platform native subprocess/resource safeguards OR explicit block of the affected production/optional rollout.

Until all verified: Phase 2 **in progress** and production **NO-GO**.

## 2026-10-22 implementation and triage update

**All 26 original automated review threads have now been given individual source-level dispositions and resolved as _narrow code-pattern findings_.** This resolution is NOT an assertion that production release gates have passed. Previously documented `PATCHED_REVIEW_BRANCH` and `HARDENING_GATE_OPEN` categories record the initial investigation state, before propagation.

- Applied fixes to the original stacked PR branches **#67, #69, #70, #71 and #72**, preserving the chain and each PR's original feature diff. No root UCE production analyzer or browser code was modified.
- Pinned, registry-integrity-bearing npm-generated lockfiles are committed and tracked. The root and isolated workflows now require `npm ci` (no `--no-package-lock`); Z3 README instructions updated.
- Local CLI exception content is redacted; new tests cover privacy, minimal subprocess environment and POSIX child-group termination.
- Z3, Soufflé, cvc5 and optional Node workers use fixed argv and `shell:false`, restricted inherited environment, bounded payload/stdout, and POSIX process-group cleanup. Nested native solvers deliberately inherit the outer optional worker's POSIX group so a worker timeout can terminate its descendants.
- Linux RSS sampling is asynchronous and best-effort. It is **not** an OS-enforced process-tree memory cap. Windows/macOS process-tree enforcement remains unverified.
- A distinct open blocker, **[#77](https://github.com/RyzovaTech/Ryzova-UCE-Original/issues/77)**, records hard process-tree memory/cleanup enforcement and the platform tests needed before any production approval.
- Prior Trilogy CI on experimental Phase 2 branch `0b067734` passed. **CI for the final stacked branch SHAs remains required; do not claim it passed merely because older commits passed.**

**Exit distinction:** Phase 2 code hardening and 26 automated review-thread dispositions are complete, but the overarching Phase 2 release gate stays **conditional/incomplete** until final-head CI, platform enforcement tests and independent reviewer acceptance. Production remains NO-GO. The real-repository human-reviewed accuracy and browser WASM gates are separate and remain open.
