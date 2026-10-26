# Trilogy T4 — Accuracy-Aware Fusion (experimental)

**Status: Draft PR #93 only. Read-only Node evidence fusion; no UCE score change, auto-fix or production rollout.**

## Safety rule

A shared title, file, category, severity or digest does NOT prove two independent detectors discovered the same defect. UCE issues remain unchanged and displayed independently of T2 source graph observations, even when T1 checks disagree on a narrow literal-source assertion. Browser-derived UCE/Trilogy/Both labels still represent correlation of UCE-extracted metadata, not independently verified vulnerability truth.

T4 deliberately emits originCounts.Both = 0. No independent claim-level ground-truth verifier or attested Git source revision is yet available. A reviewer-proposed exact UCE ID + T2 fact ID + hashed source reference may yield an **overlap-review-only** relationship when source scope is caller-declared complete and pinned by SHA-256; ambiguity, partial coverage and unsupported evidence block even that status. Nothing is automatically deduplicated or suppressed.

## Components

- Original UCE findings: indexed, hashed identity rows preserving every original issue, score, severity, and count.
- Trilogy findings: **source relationship observations**, not confirmed compatibility defects, with stable graph fact IDs and hashed source paths.
- Overlap suggestions: explicit untrusted candidate bindings, exact identity/hash validation, collision/duplicate/ambiguous fan-out handling, never automatic Both promotion.
- Source observations: T1 independently checked literal fragment status; disagreements flag an investigation rather than invalidate the UCE claim.
- Validation: Both T1 and T2 are rederived from supplied bytes and tied to the canonical evidence SHA. Inventory digest checks do not independently authenticate a signed Git commit.

Output hides raw project source, file paths and issue descriptions. Hashed paths are still susceptible to dictionary guessing. Deterministic output and bounded source/issue budgets preserve fail-closed handling. Unsupported native solver claims and forged browser Both labels are not accepted as finding truth.

## Run

    npm ci
    node --test testing/trilogy-t4/*.test.mjs
    node testing/trilogy-t4/run.mjs --output=trilogy-t4-report.json

T4 acceptance requires exact-head dedicated and full UCE CI, CodeQL, untouched UCE score/issues and passing positive/negative provenance tests. This is **not measured accuracy improvement**. Independent blinded real-project precision/recall, false positive/negative rates, recommendation correctness, authenticated source revisions and real native host tests are still outstanding (#80, #77, #81).

**Next: T5 causal *hypothesis* groupings (not verified root causes).** No production merge/deployment without owner approval and independent release gates.

Additional fail-closed rule: unresolved relative imports or unmodeled external package imports anywhere in the supplied project graph invalidate globally complete review-overlap eligibility. An indexed hashed issue map preserves linear matching instead of costly repeated scanning of every original issue.
