# Live multi-repository validation — 2026-10-07

The production browser flow at https://uce.ryzova.com/ was exercised from repository URL input through archive download, browser analysis, and the rendered report for three public repositories. No repository code or dependency scripts were executed. The same pinned checkouts were then scanned with the local UCE CLI before and after the corrections.

| Repository | Pinned checkout | Live core files / discovered | Confirmed corrections |
| --- | --- | --- | --- |
| expressjs/express | `9efc29e280018dafc1f0617f3a3d28f4e463b7be` | 214 / 214 | Recognize `.eslintrc.yml`, default `index.js`, and `nyc` coverage scripts; exclude fixture HTML performance advice |
| psf/requests | `611c6162cbc4ac2020a2f91c7cfa4f3abf9bbb60` | 123 / 130 | Recognize the multiline Apache 2.0 header; exclude documentation template performance advice |
| BurntSushi/ripgrep | `3fce3b5bb0236da2df6d99672afb8a719642eca7` | 234 / 237 | Exclude Windows path assertions inside an explicit `#[cfg(test)]` module from production platform findings |

Live scans used each repository's default branch. The SHA above pins the companion local checkout, not metadata supplied by the browser report. Archive and CLI eligibility rules differ, so file counts are reported separately rather than equated.

Local CLI inventories were 214, 128, and 236 files respectively. Before/after comparison on the same checkout removed four confirmed false findings for Express, two for Requests, and one for ripgrep, with no added finding IDs in the compatibility/extended modules. These counts describe the reviewed defects, not an exhaustive correctness label for every remaining result.

A shared inventory defect also counted every non-whitespace character as technology evidence, exhausting a 20-match limit in an ordinary workflow file. Path-presence detectors now emit one configuration observation per file. Truncated rule counts changed from 2 to 0 for Express, 2 to 0 for Requests, and 2 to 1 for ripgrep. The remaining Rust source-rule limit is retained; this change does not remove real coverage limits.

## Regression contracts

`npm run test:report-regressions` includes eight new tests (14 total) covering positive evidence, missing evidence, auxiliary-file boundaries, unrelated license prose, coverage command recognition, path inventory budgets, and offset-preserving Rust test-module exclusion. Cache version 19 prevents reuse of older detector results. Extended intelligence is 3.5.2 and the Phase 2 knowledge pack is 3.1.2.

Reproduce a scan using `node scripts/uce-scan.mjs /path/to/pinned-checkout --output=/path/to/report.json`. Existing knowledge checks, V3 fixtures, accuracy regression audits, typecheck/lint, production build and CI remain the release gates. Neither these three repositories nor passing synthetic fixtures establish a global accuracy percentage.
