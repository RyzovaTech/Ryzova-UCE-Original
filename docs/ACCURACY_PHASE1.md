# Accuracy Phase 1: measurement and report truth

## Delivered

- A frozen, offline, 230-decision corpus spanning 99 repository identities.
- Six newly captured manifests pinned to source commits across Python, Rust, Go,
  PHP, Ruby and Java; two pinned Linux source excerpts; five independent synthetic
  security cases; 217 declared-technology decisions imported from the existing
  manifest-snapshot collection. These are selected files, not 99 full scans.
- Labels describe source intent and are not generated from detector regexes.
  They are agent reviewed. Independent human adjudication is still pending.
- Per-module confusion counts and precision/recall, plus separate source strata.
  A module without labeled cases is explicitly unmeasured. `globalAccuracy` is null.
- A regression gate that allows recorded existing failures and rejects newly
  failing previously passing cases. It is not an all-cases-pass quality claim.
- A Linux triage queue preserves all 79 reported issues: two source-verified
  false positives and 77 unreviewed findings. No unreviewed alert is labeled safe.
- Partial reports no longer display a numerical overall-readiness badge.
  Inventory, text reading, core input, security/browser visits and unavailable
  module coverage are distinguished. Unknown/inapplicable categories are excluded
  from low-score remediation ranking.
- Security visit counts stop when processing stops; supplementary rule executions
  and batch time are included in scan metrics. Analysis time excludes download
  and initial ZIP extraction. Resume accumulates saved analysis time.

## Reproduce

Run `npm run audit:accuracy:baseline`. Inspect `testing/accuracy/baseline.json`.
Run `node testing/accuracy/run.mjs --record` only after reviewing a deliberate
corpus or expectation change. Commit the corpus and new baseline together.
CI refuses an unreviewed corpus checksum change. Improvements to known failures
are accepted; record a reviewed baseline afterwards to protect the improvement.

Initial results: six of six package-manager decisions correct; 217 of 217
technology-presence decisions correct; security TP=2, TN=3, FP=2, FN=0.
Security precision is 50% **on these seven selected development examples**.
The technology sample contains only positive labels, so it does not establish
false-positive performance. These figures are not worldwide UCE accuracy.

## Review protocol and further phases

Every new source case needs an immutable commit or blob reference, file location,
expected outcome, rationale, reviewer and provenance. Preserve upstream licensing
and attribution when adding source excerpts. The Linux snippets originate in
torvalds/linux (GPL-2.0); the manifests retain their project metadata.

Review source and intended behavior before looking at detector output. A second
human reviewer should resolve ambiguous labels. Use `unreviewed` when evidence
is insufficient. Never convert an unknown label into a true negative.

Split future evaluation by repository, not by file or repeated template. Keep a
held-out evaluation collection inaccessible to rule tuning, and report sample
sizes, confidence intervals and ecosystem-specific results. The present corpus
is a development baseline, not a held-out evaluation or calibrated confidence
study. The existing 120 template variants and generated rule witnesses remain
regression tests; they do not count as independent repositories.

Phase 2 fixes rule context using these failures. Phase 3 broadens actual rule
execution coverage. Phase 4 improves semantic evidence. Phase 5 validates on
independently adjudicated held-out projects. Independent human review, broad
recall evaluation and a full-repository accuracy percentage are outstanding.
