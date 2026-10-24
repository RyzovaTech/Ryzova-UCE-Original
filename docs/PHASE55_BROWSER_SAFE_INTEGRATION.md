# Phase 5.5C — Browser-Safe Unified Intelligence Pilot

This PR is intentionally **based on main**, not on the experimental Trilogy solver stack. It ports only browser-only report interpretation, quality review, and the developer-requested *local JSON request preparation* UI. Existing UCE scanner rules, default route, score, issue identities, native dependencies and symbolic reasoner behavior remain unchanged.

## Activation (default OFF)

The Root Causes navigation/tab renders only when the build-time flag \`VITE_UCE_UNIFIED_INTELLIGENCE_UI=true\` is intentionally supplied. Unset/false builds retain the existing UI and no native Trilogy execution capability. This flag is a **UI presentation toggle**, never authorization to run native processes. Release activation requires explicit owner approval.

No \`experiments/datalog-z3/\` or native solver subprocess module is imported by the new browser UI. The "Trilogy" browser-origin label describes *reinterpreted UCE-extracted metadata*, **not** independently extracted source or SMT proof. Original UCE is canonical, its score and issue record list are never mutated.

## QA and gates

- Full main-targeted CI: typecheck, lint, build, report regressions, schema/accessibility and existing trust/security gates.
- Dedicated **Chromium / Firefox / WebKit matrix** using Playwright pinned in an isolated test-only npm directory. Each job enables \`VITE_UCE_UNIFIED_INTELLIGENCE_UI=true\` and checks demo report navigation, review and evidence controls, SHA-256 developer-request flow, stale target reset, no hidden outbound requests and mobile viewport.
- Automated accessibility: keyboard-only review/flag/limitations disclosure, focus persistence, semantic landmark regions, and a bounded Phase 5.5 panel axe-core WCAG 2.0/2.1 A/AA audit. Automated scans **do not** replace manual keyboard and real screen-reader checks; a genuine assistive-technology test remains release acceptance work. Do not claim cross-browser pass until exact-HEAD matrix jobs are complete.
- Browser quality stats are structural; human-labeled false-positive/false-merge rates are explicitly **not measured**.
- Native process-tree hard resource isolation (#77), blinded accuracy (#80) and performance (#81) remain separate gates for native Trilogy activation.

Review only; do not merge or enable the flag until required checks pass and the owner authorizes it. No automatic patches, no project scripts, no native solver startup or source uploads occur through this UI.

## Review-ready acceptance matrix (current scope)

| Acceptance gate | How to check | Definition of acceptance |
| --- | --- | --- |
| Browser compatibility | `.github/workflows/phase5-browser-e2e.yml` | **All three exact-head Chromium, Firefox, WebKit matrix jobs green** |
| Automated WCAG A/AA | `testing/browser/phase5-e2e.mjs` | No scoped axe-core WCAG 2.0/2.1 A/AA violations; keyboard controls and retained focus assert correctly in all engines |
| Original UCE parity | `npm run test:report-regressions` and Full UCE CI | Score, raw native issues and provenance remain unchanged, incomplete evidence stays Unknown |
| Build flag default OFF | `VITE_UCE_UNIFIED_INTELLIGENCE_UI` not set | Existing `main` report navigation/outputs unchanged; flag activates only view content, no solver execution |
| Manual interaction review | maintainer-approved browser QA | Test with keyboard only, focus order, screen-reader announcements, mobile zoom and evidence-disclosure comprehension; **not completed by CI** |
| Release/merge approval | Maintainer/owner | Explicit approval only; PR stays Draft and no feature activation is implied by CI green |

The requested manual QA should include a representative report with zero findings, a report with clusters and an incomplete/sampled report. Confirm the `Root Causes` tab, report source references, original issues, disclosure widgets and the approval checkbox; do not assume clean verdict on absent evidence. Review the labels used for saved optional solver diagnostics, which are not formal proofs in this view.

Native advanced Trilogy execution remains out of scope; #77, #80 and #81 do not close through UI tests.
