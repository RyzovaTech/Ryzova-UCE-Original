# UCE Phase 2 — cross-browser UX stabilization (stacked on PR #92)

Scope: build on the independently verified Phase 1 reliability branch to minimize extra Vercel preview deployments. **Do not merge PR #92, PR #88, or release to production until the remaining planned phases and owner-approved final review are complete.**

## Root cause and changes

PR #88 captured reproducible document-width expansion (~1085px at 390px) across Chromium, Firefox and WebKit on the experimental Root Causes panel. Its stricter tests were not merged into `main`. This change ports the relevant regression expectations and targeted UI corrections, not its unrelated production/network benchmark workflows.

- Shrinkable `AppLayout`, `Topbar`, report workspace and main region with explicit `min-w-0` and `max-w-full` bounds; do **not** hide whole-document horizontal overflow.
- Preserve horizontal scrolling only inside the report-section navigation.
- Keep long source references, provenance and cluster headings wrapped and keyboard-focusable without cutting evidence.
- Improve contrast of the Unified Intelligence intro for its WCAG test. Maintain keyboard activation and persistent focus in quality controls.
- Enforce 320px and 390px viewport geometry assertions for full document and body on real Chromium, Firefox and WebKit, full Unified Intelligence region axe WCAG A/AA, narrow-width focus and reduced-motion rendering. Existing report parity, no-upload and local patch-request tests continue to run.

## Verification

Review the exact-HEAD CI and three-browser jobs for the stacked branch `fix/uce-phase1-rule-execution-reliability-20261026`, and ensure zero document-wide overflow. A previous PR #88 run failed [cross-browser job #40161064136](https://github.com/RyzovaTech/Ryzova-UCE-Original/actions/runs/40161064136) on this test; the new stacked run is required before marking Phase 2 automated acceptance complete.

Automated axe checks do **not** prove full accessibility. Manual NVDA/VoiceOver, high zoom (200%/400%), real phones and production browser smoke remain explicit release gates. The default-off `VITE_UCE_UNIFIED_INTELLIGENCE_UI` stays unchanged. No scoring or analysis-engine rules are modified by Phase 2.

## Overlapping draft PR

PR #88 has QA and mobile fix overlap. Do not merge #88 and #92 independently without reviewing/cherry-picking only remaining non-overlapping production smoke and real-worktree tests; otherwise duplicate changes/conflicts may occur.
