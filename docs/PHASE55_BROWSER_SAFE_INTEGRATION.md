# Phase 5.5C — Browser-Safe Unified Intelligence Pilot

This PR is intentionally **based on main**, not on the experimental Trilogy solver stack. It ports only browser-only report interpretation, quality review, and the developer-requested *local JSON request preparation* UI. Existing UCE scanner rules, default route, score, issue identities, native dependencies and symbolic reasoner behavior remain unchanged.

## Activation (default OFF)

The Root Causes navigation/tab renders only when the build-time flag \`VITE_UCE_UNIFIED_INTELLIGENCE_UI=true\` is intentionally supplied. Unset/false builds retain the existing UI and no native Trilogy execution capability. This flag is a **UI presentation toggle**, never authorization to run native processes. Release activation requires explicit owner approval.

No \`experiments/datalog-z3/\` or native solver subprocess module is imported by the new browser UI. The "Trilogy" browser-origin label describes *reinterpreted UCE-extracted metadata*, **not** independently extracted source or SMT proof. Original UCE is canonical, its score and issue record list are never mutated.

## QA and gates

- Full main-targeted CI: typecheck, lint, build, report regressions, schema/accessibility and existing trust/security gates.
- Dedicated Chromium Playwright workflow on PRs: \`VITE_UCE_UNIFIED_INTELLIGENCE_UI=true\`; demo report navigation, review and evidence controls, SHA-256 developer-request flow, stale request/target resets, no hidden outbound requests, compact-screen rendering.
- Browser QA is currently **Chromium-only**. Expand Firefox/WebKit or document per-browser acceptance before release; retain manual keyboard/screen-reader QA and product sign-off.
- Browser quality stats are structural; human-labeled false-positive/false-merge rates are explicitly **not measured**.
- Native process-tree hard resource isolation (#77), blinded accuracy (#80) and performance (#81) remain separate gates for native Trilogy activation.

Review only; do not merge or enable the flag until required checks pass and the owner authorizes it. No automatic patches, no project scripts, no native solver startup or source uploads occur through this UI.
