# Phase 3 — Smart Verification implementation / engineering evidence

**Date:** 2026-10-22  
**Implementation PR:** #78, stacked on experimental #72. **Not merged or approved for production.**  
**Design baseline:** #75 / `docs/SMART_VERIFICATION_PHASE1.md`.  
**Runtime:** explicitly opt-in local Node CLI only; no browser WASM and no network solver API.

## What is implemented

- Original `analyzeProject()` remains authoritative. Additional `report.optionalSolver` results never overwrite native `score`, `issues`, `categories`, or symbolic report.
- `evidence-inspector.mjs` is a cheap, deterministic, no-native-startup eligibility checker. A complete supported same-workspace lock graph can activate on **two constraints** (no generic size/complexity threshold), or one independently self-contradictory `engines.node` range. Unsupported/prerelease data and missing/ambiguous graphs abstain.
- Explicit stages are isolated: **Soufflé graph proof (only if required)** → **Z3 WASM Node worker** → **cvc5 native cross-check**, each in a distinct process that returns via `close` before the next stage is spawned. Z3 WASM is not retained resident in the cvc5 stage worker.
- A process-local queue allows at most one active Trilogy outer worker across concurrent opted-in scans; up to four pending scans. Full queue returns a distinct `Unknown` rather than launching simultaneous native solvers.
- Per-stage telemetry `stageTrace` records start/close relative times and **Linux sampled direct-stage worker RSS**. This is not a hard process-tree peak metric; a sample may miss a brief peak or any child RSS. Timers, output limits and per-stage soft sampled-RSS thresholds fail closed to `Unknown`.
- Stage errors, mismatched SMT outcomes, missing native executable, unknown semantics or budget failures preserve original UCE outputs.
- CVC5 now accepts a single modeled requirement only for valid scoped witness/proof workflows; single ordinary satisfiable declaration is skipped by Inspector, not spuriously presented as whole-project SAT.
- Existing standalone `evaluateDatalogZ3Cvc5` is unchanged for independent historic experimental benchmarking; the optional UCE adapter is routed to the new sequential pipeline instead.

## Eligibility rules implemented

| Rule | Decision |
| --- | --- |
| D0 | Default disabled: no solver process |
| D1 | Workspace root and explicit nested workspaces scoped separately |
| D2 | 2+ valid supported numeric Node requirements: eligible |
| D3 | One self-contradictory requirement: eligible |
| D4 | Require Soufflé for dependency graph proof used by the selected facts |
| D6 | Invalid, unsupported, incomplete evidence: Unknown with no global proof |
| D8 | Over model budget: explicitly Unknown / eligible-but-abstained |
| D10 | One satisfiable or no modeled obligations: skip with no solver |
| D5/D7/D9 | Diagnostic priority, verified-subset support and richer canonical dedup are design follow-ups; not claimed fully implemented |

### Domain constraints

Only supported npm `package-lock` v2/v3 **hoisted** graph relations and stable numeric Node `engines.node` are modeled. npm aliases, nested installations, ambiguous optional/peer semantics, prerelease/dynamic ranges, incomplete/sampled scans, and non-Node ecosystems remain outside the proof envelope. A SAT witness is a mathematical declaration witness, **not real installation/build/runtime compatibility**.

## Lifecycle guarantees and limits

The orchestration code starts each stage only after the prior direct stage worker emits `close`; exceptions abort subsequent stages. The outer worker resides in an isolated POSIX process group and performs group teardown at completion. This is **not yet proof** of full recursive child-tree cleanup for every OS or an OS-enforced 512MiB process-tree memory cap. **Issue #77 remains open and blocks production approval.**

The optional outer-worker default wall clock budget is currently 15 seconds. Stage timers are bounded by the remaining outer deadline. The 512 MiB per-worker RSS target is a sampled Linux guard; macOS/Windows report no reliable per-stage RSS until platform-specific enforcement is implemented. Do not present memory reduction as a measured percentage before cold/warm comparative benchmarks.

## Tests and acceptance evidence

- Test inspector determinism, 2-range activation, 1-range contradiction, no-question skip, unsupported prerelease/incomplete graph, and workspace separation.
- Test real Soufflé/Z3/cvc5 end-to-end proof, one engine failure with no downstream process, and same-score/issue/symbolic parity for disabled and enabled reports.
- Verify ordered `stageTrace`: preceding `closedMs <= next startedMs`.
- Test concurrent opted-in scans with the single outer-worker queue.
- Existing hard failure/timeout/sampled-RSS tests and historic Trilogy synthetic holdout CI must still pass.
- **Final-head CI run links and sign-off must be recorded after completion.** A green older PR cannot substitute for Phase 3 final-head verification.

## Remaining gates (not part of a production-approved Phase 3 claim)

- #77: OS-enforced full process-tree memory hard cap, descendant cleanup and cancellation across supported Linux/Windows/macOS environments.
- Hard memory reduction benchmark with explicit before/after, same workload, cold-start and platform details.
- Independent, blinded human-reviewed real-repository accuracy. Existing synthetic 40/40 is not independent accuracy.
- Browser WASM remains unimplemented and unapproved.
- Explicit maintainer security approval, clean full UCE regression suite and sequential merge sign-off.

**Phase 3 code status** can be considered implemented after final-head experimental and full UCE CI both pass; **production merge remains NO-GO** until separate release gates above are complete.
