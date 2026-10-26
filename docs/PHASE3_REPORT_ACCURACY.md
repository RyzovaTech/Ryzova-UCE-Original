# UCE Phase 3 — Analysis & Reporting Accuracy

**Branch:** `fix/uce-phase1-rule-execution-reliability-20261026` (PR #92), stacked on Phase 1 + Phase 2.
**Release policy:** no merge into `main` and no manual production deployment until all phases have passed final owner review. Pushes may cause automatic Vercel preview checks configured by GitHub.

## Audited problems and fixes

1. **V3 finding coverage:** `collectWorkspaceFindings()` previously imported only V3 packs whose name contained `.v3-phase4.` or `.v3-phase5.`; V3 Phase 2/3 and other packs were silently excluded. All saved V3 findings now enter the normalized workspace regardless of pack naming, with explicit `packId`, rule ID, source file and line. V3 is static-review evidence, not a verified runtime defect.
2. **False deduplication:** Normalization previously equated findings from the same module with the same title and file/line even when rule IDs, severity or source evidence differed. The new deterministic identity includes module, provenance, location, severity, evidence and recommendation. Exact same-record repeats may still deduplicate; independent evidence is preserved. Generated security mirror suppression requires an actual matching source security finding; orphaned legacy issues remain.
3. **Misleading score comparison:** When either scan is partial/unknown, `compareReports()` now returns `scoreDelta: null` and avoids claiming missing findings were resolved. Category deltas only apply where both categories were assessed. The history chart displays a separate partial state rather than a false numeric improvement. Observed new or persisting findings are still accessible.
4. **Scope and limits:** V3 budget truncation, unfinished archive sweeps, omitted findings, rule crashes and partial scan coverage all prevent project-wide readiness claims even when file inventory is complete. Canonical source data and original core scores stay intact.
5. **Display/export labels:** Markdown explains that the weighted score covers applicable core compatibility categories, and V3 observations are separate unscored review signals. Browser enrichment displays at most 1000 prioritized findings (critical first), but documents the omission count; canonical original issues remain available.

## Invariants / acceptance checks

- **No changes to UCE native compatibility rule packs, weight constants, severity logic or formula.**
- No source execution, upload, LLM-derived proof, unbounded recursion, production flags or patch auto-apply.
- No evidence conflation: same title/file but distinct rule/evidence/severity remain independently visible.
- Do not relabel V3 static signals as independent Trilogy extraction or formal solver evidence.
- `src/lib/report/workspace.ts` and `src/lib/report/unified-intelligence.ts` are report views, not score engine modifications.
- Regression tests: `testing/report/phase3-report-accuracy.test.mjs` (full provenance, V3 phase coverage, source mirrors, partial comparison, old report parity, display budget, SARIF, Markdown, no mutation).
- Exact-head Full UCE CI and Chromium/Firefox/WebKit E2E required for acceptance.
- Manual accessibility/high-zoom/device checks and other planned phases remain release gates.

Historical numeric scores remain in raw JSON and portable reports for backward compatibility; presentation labels and comparable deltas convey interpretation rather than rewriting saved results. Neither 95.69% reported language-label agreement nor any sampled report establishes independent global compatibility accuracy.
