# Phase 4 — Complex Engine, Simple UX

Phase 4 starts a new report workspace over the existing deterministic analysis
engines. The engine data contracts remain compatible; the presentation layer now
reveals detail progressively instead of rendering every result on one page.

## Implemented in the first increment

- Eight-section report navigation: Overview, Technology, Code & Architecture,
  Security, Compatibility, Quality, Issues, and Project Map
- One active report section at a time
- Versioned Simple, Developer, and Expert mode preference
- A ten-second Overview that answers project identity, primary concern, and next action
- Overall readiness, critical issue summary, attention areas, top five actions,
  technology identity, scan confidence, and analysis limitations
- Soft-detection vocabulary: Confirmed, Likely, Possible, Review required,
  Not enough evidence, and Not applicable
- Progressive technical evidence using explicit disclosure controls
- Issue search plus severity, category/module, and file filters
- Session-level reviewed and suppressed states
- Expert-only raw JSON and selected-finding exports
- Responsive horizontal report navigation for smaller screens

## Mode behavior

- **Simple:** plain summaries, prioritized actions, no file paths or graphs by default
- **Developer:** file paths, evidence, recommendations, dependencies, and code details
- **Expert:** full available evidence, rule IDs, graph-oriented views, suppression,
  and JSON export

## Completion status

The remaining report workflow items were completed in the next increment. See
`PHASE_4_COMPLETE.md` for the final behavior and verification baseline.

## Verification baseline

- 663 deterministic engine and report-workspace checks
- TypeScript typecheck and ESLint
- Production build and dependency audit
- Browser verification is required when a runnable Chromium environment is available
