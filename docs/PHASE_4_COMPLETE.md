# Phase 4 Complete — Complex Engine, Simple UX

Phase 4 is complete. UCE keeps its deterministic intelligence engines intact
while presenting their results through a progressive, mode-aware report workspace.

## Navigation and ten-second overview

- Overview
- Technology
- Code & Architecture
- Security
- Compatibility
- Quality
- Issues
- Project Map

Only the active section is rendered. The Overview answers project identity,
the most important concern, and the next action before exposing technical detail.

## Detail modes

- **Simple:** plain-language summaries, top actions, and minimal technical detail
- **Developer:** paths, lines, evidence, recommendations, and dependency details
- **Expert:** full findings, rule IDs, confidence, graphs, suppression, selection,
  raw JSON, and selected-finding export

The selected mode is stored locally with a versioned preference key.

## Unified Issue Center

- Combines compatibility, security, browser, and extended-intelligence findings
- Search across title, description, evidence, and file path
- Severity, intelligence-module, and file filters
- Deterministic grouping of structurally similar findings
- Individual and group-level reviewed state
- Individual and group-level false-positive suppression
- Optional display and restoration of suppressed findings
- Expert selection and module-aware JSON export
- Export metadata includes schema version, report and engine versions, modules,
  reviewed IDs, suppressed IDs, and export timestamp

Reviewed and suppressed states are versioned and stored locally per report. No
source or finding data is transmitted.

## Comparison and history

- Compatible scans are matched by normalized project identity
- A report can be stored locally as the project baseline
- Comparisons show overall and per-category score deltas
- Findings are classified as new, resolved, or persisting using stable fingerprints
- Up to eight local scans appear in the project health history

## Detection language and disclosure

UCE uses Confirmed, Likely, Possible, Review required, Not enough evidence,
and Not applicable. File paths, raw evidence, confidence, and rule IDs are hidden
until the selected mode or an explicit disclosure control requests them.

## Verification baseline

- 663 deterministic checks, including unified findings, grouping, comparison,
  regression/resolution tracking, and project compatibility matching
- TypeScript typecheck
- ESLint
- Production build
- Production dependency audit
- Exact Git tree verification before release

Static results remain review signals rather than guarantees of runtime behavior,
security, accessibility, browser behavior, or legal license compliance.
