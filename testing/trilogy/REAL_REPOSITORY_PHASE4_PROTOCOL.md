# Phase 4 — Independent Real-Repository Accuracy Evaluation

**Status (2026-10-22):** REAL REPOSITORY INTAKE PREPARED; **INDEPENDENT HUMAN GROUND TRUTH IS NOT COMPLETE**. Do not report independent accuracy based on an unlabeled candidate list or the 40/40 authored synthetic holdout.

## Scope and validity
1. Lock the project commit, workspace root, and exact byte-level `package.json` plus any committed `package-lock.json` as seen at that commit. Verify Git blob SHA and provenance before analysis. Never run `npm install`, scripts, code or arbitrary repository executables as part of sampling.
2. Prefer broad sampling over eligible and ineligible repos and freeze the selection *before seeing solver outputs*. Record the selection criteria and exclusions. Initial candidate manifest `real-repository-intake-v1.json` contains 4 **unlabeled** public repositories and must NOT be scored as a labeled corpus.
3. Supported model question: can all source-backed, applicable production-path `engines.node` stable numeric ranges in a *complete supported* npm hoisted v2/v3 lock graph share one valid stable numeric Node version? A "SAT" modeled result does not establish actual runtime compatibility, npm enforcement or successful installation.
4. If the lock is absent, stale, workspace ambiguous, nonnpm or too large/unsupported, the model's correct status may be **Unknown**. Do not infer SAT from no observed conflict.
5. Each eligible case is labeled by **two independent reviewers blinded to solver outputs**. Each reviewer records source paths, root/transitive applicability, semver reasoning, evidence completeness, label (`conflict`, `satisfiable`, or `unknown`), full reasoning and reviewer timestamp.
6. Disagreement requires a third adjudicator. Keep all original reviewer votes, immutable source identifiers and decision rationale. Record selection and conflict of interest; reviewers may not use solver answers as the ground-truth oracle.
7. Do not publish accuracy until a frozen corpus with fully adjudicated labels and source snapshots is available. Observations must be computed separately and joined by immutable case ID; reviewer labels must remain immutable. Preserve raw and final `Unknown`.
8. Report TP/TN/FP/FN, unknown, coverage, precision, recall, FPR, conservative recall and confidence intervals **on an independent, human-adjudicated real-repo corpus**, with exact sample size and label support. Report opportunity-eligibility rate and excluded reasons separately.
9. Run cold/warm memory and latency evaluations at pinned Node/Soufflé/Z3/cvc5 versions. Distinguish kernel-enforced `memory.peak` from sampled direct-worker RSS, and legacy monolithic versus stage-serial tests. No estimated percent savings without comparable repeated controlled measurements.
10. Results cannot authorize browser WASM, score changes or production deployment. Existing Original UCE behavior must remain byte-for-byte unchanged in scored fields.

## Initial *candidate only* snapshots (verified via GitHub metadata)
- `RyzovaTech/Ryzova-UCE-Original@6f1ae44e5e08d1be11545fd0e63287a7a55394ea`: root manifest and lockfile present, likely far larger than the supported bounded graph. **Label pending.**
- `expressjs/express@0dee2c52c7c873498f8ed7d8ee4ddd0a04d3ada8`: root manifest; no root package-lock observed at this exact pinned commit. **Label pending.**
- `fastify/fastify@ce41dc0fbb4ed75e9a42f3972ac896333f6a7396`: root manifest; no root package-lock observed at this exact pinned commit. **Label pending.**
- `sindresorhus/slugify@3b17b2e84b97624a683aafaa38184bf2746fab22`: root manifest; no root package-lock observed at this exact pinned commit. **Label pending.**

These four intake candidates are **not representative**, not a statistically valid sample, and contain no verified TP/TN/FP/FN counts.

## Reviewer worksheet — create one per reviewer per case, outside model outputs
```json
{
  "caseId": "RR01",
  "repository": "<full owner/repo>",
  "commit": "<full 40-hex git SHA>",
  "reviewerId": "<independent reviewer identifier>",
  "reviewedAt": "<ISO8601 timestamp>",
  "blindedToSolverOutput": true,
  "scope": "<workspace>",
  "sourceEvidence": [{"file":"package.json","field":"engines.node","range":"...","sourceBlobSha":"..."}],
  "applicabilityProof": "<how each reachable production dependency was established>",
  "limitations": ["..."],
  "label": "conflict | satisfiable | unknown",
  "rationale": "<explain the mathematical joint satisfiability and evidence coverage>",
  "adjudicationRequired": false
}
```

**Gate:** human review/adjudication and independent accuracy remain open. An AI-generated label, an unreviewed repository or a high synthetic benchmark score must never satisfy this gate.
