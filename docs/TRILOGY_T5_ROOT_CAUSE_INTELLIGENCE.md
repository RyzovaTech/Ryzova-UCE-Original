# Trilogy T5 — Root Cause Intelligence (review hypotheses, not proven causes)

**Status:** Isolated experimental Draft PR #93. Read-only Node-only investigation layer. Original UCE score and issues stay canonical; this is not production browser/MCP behavior.

## Why this exists

Developer projects can be severely harmed if speculative correlations are described as confirmed causes or lead to unsafe dependency/runtime upgrades. T5 organizes **source-anchored investigation leads** without claiming root-cause discovery has been independently validated.

### Evidence policy

- T5 re-runs T4 conservative fusion and T2 AST source-graph extraction against the **same supplied local source bytes**. No T2/T4 client-supplied status, saved browser `Both` label or untrusted native solver response can authorize a cause.
- Only complete caller-declared inventory with matching SHA-256 source inventory digest and no incomplete/unknown module imports, unreadable files, unmodeled package imports, parse failures or exceeded graph budget can produce review groups. The SHA digest binds supplied bytes but does **not** authenticate an upstream Git commit.
- Each group has exactly one valid **hashed source-file anchor**. Local outgoing source imports/workspace links are explored at **1–2 directed hops**, up to **32 edges per anchor**. Runtime `engines.node` vs `.nvmrc` / `.node-version` modeled mismatch can produce a dedicated *runtime constraint review* group. No import build, network or runtime execution is established.
- Groups are ordered by the **existing canonical UCE severity** on the same source anchor (critical before warning before info), and no severity is recalculated. This is a *review order*, not measured probability, blast radius or real-world impact. Unassociated observations cannot inherit a severity.
- Max **100 groups** are displayed; `omittedHypotheses` discloses omitted ones and `ungroupedIssueHashes` retains issues outside displayed groups. All canonical issue indexes, severities, hashed IDs and total count remain in the separate original record list. **No deduplication, suppression or deletion**.
- Only bounded hashed identities, fact IDs and count-based possible reachability appear in generated T5 evidence. Raw source code, source paths, issue prose and recommendations are excluded. Hashed path identity can still be guessed with candidate dictionaries.

### Output semantics

Every group explicitly states `status: review-hypothesis-only`, `rootCauseVerified: false`, `causalityProven: false`, `blastRadiusVerified: false`, and `safeFixKnown: false`. Results show `rootCauseVerifiedCount: 0` and `originCounts.Both: 0`. A literal T1 disagreement does **not** make a canonical UCE finding false.

Incomplete/partial inventories -> no root-cause hypotheses, no score certification. Unknown is **not clean**. The safety gate does not infer a safe fix or automatic upgrade. Real-world precision/recall/false-positive/false-negative rates, recommendation correctness and verified cause statistics remain `null` / zero without independent adjudication.

### Reproduce

```bash
npm ci
node --test testing/trilogy-t5/*.test.mjs
node testing/trilogy-t5/run.mjs --output=trilogy-t5-report.json
```

The dedicated T0–T5 CI verifies regression cases for isolated findings, same-title collisions, mixed severities, a two-hop graph, runtime review, partial scans, missing imports, unmodeled packages, parser errors, disputed literals, input ordering, cap/truncation and no autofix. Full original UCE CI and CodeQL must still pass on the **exact same Git SHA**. No native Soufflé/Z3/cvc5 host acceptance is claimed: the delegated-kernel integration test remains pending.

### Next: T6 developer-safe fix proposals

Future patches must be based on independently checked source/evidence and narrow preconditions; no changes outside developer review, explicit target fingerprints, risk analysis, build/test verification. T5 source hypotheses **alone cannot authorize a patch**.

**Remaining release blockers:** signed original source revision binding; independent blinded real-project truth review (#80); native delegated hard-isolation, filesystem/network and Windows policy (#77); representative memory/perf acceptance (#81); owner review before merge/deployment.
