# UCE Smart Verification — Phase 1 Architecture Contract (v1)

**Date:** 2026-10-22  
**Status:** Design baseline completed; implementation, benchmark validation, and production approval are NOT complete.  
**Decision:** Maximum Verification Coverage (A), evidence-driven selection, serial native verifier lifecycle.  
**Repository scope:** `RyzovaTech/Ryzova-UCE-Original`, separate document-only design branch based on `main`.  
**Existing experiment chain:** #67 (Z3) -> #69 (Soufflé/Z3) -> #70 (cvc5) -> #71 (optional reporting) -> #72 (synthetic holdout).  
**Production decision:** NO-GO. This document does not authorize production or browser deployment.

## 1. Non-negotiable invariants

1. `analyzeProject()` remains the authoritative original UCE assessment. Its `issues`, `score`, `categories`, symbolic-reasoning output, and web analyzer behavior must be regression-identical with Smart Verification enabled or disabled.
2. Trilogy remains **open-source, local-first, offline-capable, Node-only and explicitly opt-in** in v1. No remote inference, mandatory external service, production browser WASM import, COOP/COEP change, scoring adjustment, or user-project code execution.
3. Never decide eligibility from project size, number of files, generic complexity, or the mere presence/absence of an original UCE warning. Size and time limits may force bounded abstention **after** eligibility is determined.
4. Only source-backed supported evidence is eligible for a modeled claim. A missing/incomplete/sampled graph cannot be silently treated as complete. No whole-project SAT/compatibility conclusion may follow from partial data.
5. Only **one native verification stage at a time**; the prior stage's process group/tree must have exited and cleanup must have been verified before launching the next native stage. Stage failure is an abstention, never implicit proof.
6. Keep `modeled satisfiable`, `modeled unsatisfiable`, and `Unknown` distinct from actual npm `engine-strict` enforcement and install/build/runtime compatibility.
7. A successful cross-check needs agreement between independently encoded Z3 and cvc5 checks on **exactly the same normalized constraints and supported numeric version domain**, plus original-source witness/contradiction evidence validation. Solver agreement is not an independent field-accuracy statistic.
8. Automated review findings are not automatically confirmed vulnerabilities; triage every security review thread individually with source-level evidence before closure.

## 2. Roles and decision boundaries

| Component | Role | May alter native UCE findings? | Startup |
| --- | --- | --- | --- |
| Original UCE | Primary analysis and native compatibility assessment | Owns original findings | Always |
| Evidence Inspector | Cheap deterministic eligibility, evidence grouping, capability checks and completeness labels | No | Only in optional local verification flow |
| Soufflé | Derive dependency reachability and source-backed path proofs | No | Only if transitive/lockfile graph proof is necessary |
| Z3 | Solve supported stable numeric Node semver conjunction and generate source-linked result | No | Only for eligible supported constraint system |
| cvc5 | Independently re-solve exactly the same normalized constraints | No | Only after successful Z3 and required predecessor cleanup |
| Result validator | Revalidate paths, input hash, witness/core and solver agreement | No | Lightweight parent-side work |

The inspector chooses **whether a meaningful model can be solved**, not whether a project is "large" or "complex". It must not rely solely on `nativeStatus=conflict`; a native SAT or no-warning assessment may still conceal joint unsatisfiability.

## 3. Evidence and eligibility contract (normative)

Inputs are immutable snapshots drawn from the finished original UCE scan: canonical source-path identifiers, exact workspace identity, manifest/lockfile evidence, scan-completeness flags, normalized Node engine requirements, and a stable digest of the selected evidence. The inspector must not execute project scripts or install dependencies.

### Eligibility decisions

- **D0 — Not enabled / not software:** native result only; `disabled` or `skipped` reason; no process.
- **D1 — Scope separation:** enumerate exact workspace scopes deterministically; root `""` means root only. Do not combine constraints from unrelated sibling packages or infer cross-workspace dependencies.
- **D2 — Two or more applicable independent requirements:** eligible for SMT if they refer to the **same runtime domain**, have accepted numeric semver semantics, valid source provenance, and their scoped evidence is complete.
- **D3 — One independently self-contradictory requirement:** eligible if the range can be modeled exactly, including an empty intersection; do not discard it merely because there is only one requirement. One unconstrained or ordinary satisfiable requirement is not an SMT trigger.
- **D4 — Reachable production dependency relationships:** select Soufflé first when a supported lock graph is required to establish applicability of transitive constraints. Require full supported graph evidence; a declared but unreachable package must never generate a conflict proof.
- **D5 — Native UCE finding/uncertainty:** elevate reporting priority or focus candidates, but never make native findings a required trigger and never let their absence suppress D2-D4.
- **D6 — Unsupported evidence:** malformed, missing, sampled, truncated, ambiguous, stale, alias, nested, optional/peer or otherwise unsupported graph or nonnumeric/prerelease semver semantics -> `Unknown` for that intended proof scope, with specific reason; no global SAT/UNSAT claim.
- **D7 — Verified independent subset:** a fully proven, independently scoped subset may be reported as a *subset-scoped diagnostic* only if it is semantically sound without missing facts (for example, a self-contradictory root declaration). It cannot establish whole-workspace satisfiability or unsupported graph reachability. A subset claim must be visibly labeled as such.
- **D8 — Resource pressure:** still count the input as *eligible but abstained* when memory/time/capability budgets prevent execution. Do not relabel it ineligible because it is large.
- **D9 — Deduplication:** canonicalize duplicate declarations, distinguish independent sources, record a deterministic evidence digest, and sort workspace scheduling; avoid repeated solver work for identical snapshots if a strictly local and bounded cache is ever introduced (no cache required for v1).
- **D10 — No applicable modeled obligations:** finish as `skipped/no-supported-question`, not `satisfiable`.

### Initial supported domain

Phase 1 defines the *initial* truthful coverage envelope, not an assertion of all-ecosystem support:
- Explicit Node `engines.node` stable numeric version constraints, modeled with faithful npm-semver normalization.
- Exact same-workspace source provenance; for dependency reachability, npm `package-lock` v2/v3 **hoisted-only** graphs with validated direct and transitive production edges.
- In v1, unsupported npm aliases, nested resolution, unresolved peers/optionals, git/workspace protocols, stale/inconsistent locks, dynamic tags, prereleases, and incomplete/sampled scans abstain. Extend only after separate independently tested semantics.
- For graph-free direct constraints, permit a solver stage only when the inspector can independently establish source authenticity and applicability in the same workspace. Do not claim an installed dependency requirement without a reliable dependency proof.

**No size threshold as a trigger.** Counts (for example current solver maximum of 12 constraints) are **capability/budget limits**; exceeding them produces an `eligible-but-unsupported/budget-abstained` outcome with coverage accounting, rather than a silent skip.

## 4. Execution state machine

```text
Original UCE analyzer (unchanged)
  -> opt-in gate
  -> Evidence Inspector [no solver import/spawn]
      -> DISABLED / SKIPPED / UNKNOWN if unsupported
      -> ELIGIBLE
          -> Soufflé subprocess only if graph proof required
          -> verify reachability/provenance and full exit/cleanup
          -> Z3 isolated Node/WASM subprocess
          -> validate Z3 witness/core; ensure full process exit/cleanup
          -> cvc5 isolated subprocess
          -> validate result, ensure full exit/cleanup
          -> confirm equivalent normalization and independent SMT agreement
          -> separate optional diagnostic, native result untouched
```

Each stage has explicit `not-run | running | succeeded | unknown | failed-budget | failed-cleanup` states. `Unknown` or `failed-cleanup` prevents a downstream native launch. Cancellation, crash, parse error, output overrun, timeout, missing binary, unsupported platform, or verifier disagreement must fail **closed to Unknown**, preserving native UCE results.

Soufflé and the two SMT engines provide different proof obligations; do **not** display their results as three independent votes on accuracy. cvc5 should not be spawned after a Z3 `Unknown`, except in a separate explicitly approved diagnostic experiment that cannot issue a confirmed verdict.

## 5. Memory / process / security contract

**Provisional engineering targets, NOT validated guarantees:**
- Native verifier concurrency: `1` stage process tree at a time, with a single top-level workspace verification queue.
- Initial per-verification process-tree memory budget: `512 MiB`; subject to measured platform-specific enforcement and calibration.
- Initial end-to-end optional verification budget: `15 s`; queue-wide deadline across all selected scopes, not an unlimited budget multiplied by workspace count.
- Retained native solver workers after each completed scan: `0`.

**Enforcement requirements before launch:**
1. Launch fixed, reviewed executables with argument arrays, `shell:false`, trusted configuration and minimal environment. Never derive executable paths or command options from uploaded source content. Provide bounded request/stdout/stderr.
2. Prefer an OS-enforced memory cap for the **full process tree** (Linux cgroups/appropriate job isolation; Windows Job Objects; platform-validated alternative on macOS). Linux `/proc/<pid>/status` sampling of the Node parent is diagnostic only and does **not** establish the native-tree cap.
3. On timeout or cancellation terminate and **reap all descendants**. Do not start another native stage until process-tree termination is confirmed. POSIX process-group SIGKILL alone is not a proven cross-platform tree guarantee.
4. Restrict temporary files/directories, validate canonical paths and symlink behavior, bound parsed lockfile input, and prevent project-code execution. Redact source paths/contents from logs and CI artifacts as appropriate.
5. Reproducibly pin and integrity-check isolated npm dependency trees and native binaries. Review platform availability, upstream hashes, licenses, installation provenance and CI clean-install behavior.
6. When strong platform isolation is unavailable, retain optional Node-only experiment and report budget enforcement as `unverified` or refuse that verifier; never imply the target is enforced.

Measure cold/warm stage startup, wall time, parent and descendant RSS/peak memory, cleanup completion, process counts, timeout success, and overhead against original UCE at multiple workloads/OS runners. Sequential execution reduces *overlapping* residency but does not prove Z3's individual peak is below budget.

## 6. Typed result contract (proposed)

```ts
type StageState = 'not-run' | 'succeeded' | 'unknown' | 'failed-budget' | 'failed-cleanup';
type VerificationStatus =
  | 'disabled' | 'skipped' | 'eligible-abstained' | 'unknown'
  | 'modeled-sat-cross-verified' | 'modeled-unsat-cross-verified';
type OptionalVerification = {
  version: 1;
  enabled: boolean;
  status: VerificationStatus;
  scope: string;
  scopeKind: 'workspace' | 'verified-subset';
  evidenceComplete: boolean;
  normalizedEvidenceDigest: string | null;
  eligibilityRules: string[];
  reasonCodes: string[];
  stages: { souffle: StageState; z3: StageState; cvc5: StageState };
  witness: string | null;
  unsatEvidence: Array<{ file: string; field: string; range: string; dependencyPath?: string[] }>;
  declaredSemanticsOnly: true;
  budgets: { configuredWallMs: number; memoryBudgetMiB: number; processTreeEnforced: boolean };
  metrics: { elapsedMs: number | null; measuredTreePeakMiB: number | null };
};
```

No verification-produced accuracy percentage, confidence number, compatibility score change, or automatic resolution of native UCE issues. UI/report wording must distinguish an unattempted eligible case, unsupported case, runtime budget abort, graph proof, and cross-verified modeled SAT/UNSAT.

## 7. Verdict matrix

| Graph (if required) | Z3 | cvc5 | Allowed diagnostic |
| --- | --- | --- | --- |
| valid/omitted for direct evidence | SAT + validated witness | SAT + exact-equivalent encoding | modeled SAT, cross-verified, **scoped** |
| valid/omitted for direct evidence | UNSAT + validated provenance | UNSAT + exact-equivalent encoding | modeled UNSAT, cross-verified, **scoped** |
| any | SAT | UNSAT | Unknown; disagreement |
| any | UNSAT | SAT | Unknown; disagreement |
| any | Unknown/error/timeout | not run | Unknown; preserve native |
| incomplete/unverified graph required | not run | not run | Unknown; no reachability assertion |
| any | SAT/UNSAT | Unknown/error/timeout | Unknown; no cross-verification |
| any | stage cleanup not confirmed | not run | Unknown; stop native execution |

## 8. Coverage and independent accuracy metrics

Publish separate denominators. A project-size/complexity metric is **not** an activation rule.

1. **Opportunity count:** all semantically meaningful same-domain constraint groups discovered by the deterministic inspector, regardless of later budgets.
2. **Eligible modeled coverage:** fully supported opportunity groups / all opportunity groups; record unsupported reasons.
3. **Attempted coverage:** eligible groups actually attempted / eligible groups.
4. **Cross-verification coverage:** source-validated Z3+cvc5 agreements / eligible groups; report budget abstentions separately.
5. **Abstention and disagreement rates:** distinguish unsupported, unattempted, timed-out, graph-unknown, verifier-disagreement.
6. **Accuracy:** on a separately frozen, independently human-reviewed **real-repository** corpus report TP/FP/FN/TN, unknown, conservative recall, precision, negative-label FPR, coverage and confidence intervals, plus exact scope and semantics.
7. Never generalize the existing 40/40 development-authored holdout to independent real-world accuracy.

## 9. Phase 2+ acceptance test plan (specified, not yet executed)

- Tiny valid workspace with multi-source disjunction and 3-way joint UNSAT triggers full SMT cross-check even when original UCE has no warning.
- Large project with no supported verification question triggers zero native workers; large project with eligible question is not silently skipped for size.
- Single self-contradictory stable numeric Node requirement is eligible; a single ordinary requirement does not imply global SAT.
- Same-workspace independence and root/nested/sibling paths; unreachable contradictory dependency cannot produce a reachable conflict.
- Lock graph with aliased, nested, stale, missing, optional/peer, unsupported, or sampled evidence abstains without partial whole-graph proof.
- Missing Soufflé binary, failed Z3 initialization, cvc5 disagreement, excessive output, timeout and cancellation all preserve original UCE score/issues and return Unknown.
- Full process-tree termination and no overlap under ordinary, abnormal and cancelled execution, with platform-specific enforcement evidence.
- Force memory-budget violation and verify subsequent stage never starts while children remain alive.
- Compare native result/report fields byte-for-byte (except optional diagnostic additions) and browser build/worker/ZIP/GitHub import regression behavior.
- Check zero network calls and no code execution from repository sources, safe subprocess parameters, redacted diagnostic logging, reproducible installation.
- Validate real-repository ground-truth sampling and blind review before production approval.

## 10. Phase 1 exit criteria and release policy

**Phase 1 design deliverables:** named engine roles, exact initial supported semantics, evidence-driven decisions D0-D10, scoped proof and Unknown policy, serial lifecycle, provisional memory/time targets, reporting contract, test plan, and unchanged-production invariants. **Design complete when this document is committed and a documentation-only draft PR is opened.**

**Not part of Phase 1:** runtime implementation, remediation of 26 unresolved security review threads, lockfile generation, independently reviewed real-project accuracy, hard cross-platform memory enforcement, CI on new code, or production merge.

**Phase 2 entry:** individually triage review threads on PRs #67-#71, fix confirmed security/dependency blockers on isolated experiment branches, and run tests before architectural refactoring. Stage improvements must flow through the existing stacked PR chain only after reviewed base/ref planning.

**Merge policy:** NO-GO for production until security review, supply-chain verification, reproducible builds, platform resource enforcement, independently adjudicated real-project evaluation, and full existing UCE regression + experimental CI are independently accepted. Browser WASM remains a separate unapproved design.
