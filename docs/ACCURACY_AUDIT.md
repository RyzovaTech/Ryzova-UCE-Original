# Bounded accuracy audit — 2026-09-26

This is a development-set regression audit, not a certified or independent estimate of UCE accuracy across real repositories. The 30 hand-labeled binary decisions were selected to probe known risk areas: root ecosystem identity (4), technology evidence and scope (12), pickle-pattern presence (6), dependency inventory (8). Security labels mean a review pattern is present, not that a vulnerability is exploitable.

| Metric | Before | After |
| --- | ---: | ---: |
| Correct decisions | 26/30 | 30/30 |
| Accuracy | 86.67% | 100% |
| True positives | 12 | 15 |
| True negatives | 14 | 15 |
| False positives | 1 | 0 |
| False negatives | 3 | 0 |
| Precision | 92.31% | 100% |
| Recall | 80% | 100% |

Baseline: implementation following PR #28. The baseline and current JSON files contain every case and its label. The same cases guided fixes, so the improved score is deliberately not presented as holdout generalization. The numbers are composite decisions, not a security-detection precision score.

## Changes

- Reject dependency arrays rather than inventing packages named `0`, `1`, etc.
- Handle null/scalar/array package manifests without throwing.
- Count supported manifests inspected even when they declare zero dependencies.
- Include bounded Cargo and Go declaration inventory, preserving supported versions, aliases, build/dev roles and optional dependency markers.
- Mark Cargo workspace-inherited versions explicitly rather than pretending they were resolved.
- Add `npm run audit:accuracy` to CI; failures cause a nonzero exit.
- Advance analysis cache revision.

## Interpretation and remaining work

The existing Phase 5 corpus has 120 entries generated from 12 repeated scenario layouts. Those entries are not 120 independent real-world projects. Similarly, 30,000 generated rule assertions measure fixture conformance, not real-world precision or recall.

Global UCE accuracy remains unmeasured. Establishing it requires a separate held-out, manually reviewed repository set covering language/framework families, ZIP/GitHub inputs, negative examples and project sizes. Freeze expected findings before tuning; publish per-module precision, recall, missed findings, scan coverage and latency. An aggregate score should not conceal unsupported modules.

Cargo/Go readers remain bounded declaration readers: no full TOML parsing, Cargo resolution, macro expansion or transitive dependency audit. Workspace inheritance is labeled, not resolved; indirect Go requirements are retained as manifest entries. Inventory is not a vulnerability audit. Large-project coverage and browser performance require separate end-to-end measurements.
