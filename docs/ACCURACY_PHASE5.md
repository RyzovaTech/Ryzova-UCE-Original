# Accuracy Phase 5: pinned evaluation and release gate

Phase 5 introduces a separately versioned evaluation corpus with 8 public
repositories, 8 positive and 8 negative technology-presence decisions. Each
manifest excerpt is attributed to a specific source commit and file. JSON
examples retain selected manifest fields; other examples use a leading source
excerpt or a complete small configuration file. The evaluation runner rejects
duplicate projects, unpinned commits, missing rationales, absent positive or
negative labels, and any repository that appears in the development corpus.
It evaluates the frozen labels without rewriting them from scanner output.

Run `npm run audit:accuracy:holdout`. CI checks the corpus checksum and rejects
regressions on previously passing decisions. To alter labels or excerpts,
review source provenance first and explicitly run
`node testing/accuracy/holdout.mjs --record`; commit both corpus and baseline.
The baseline intentionally retains missed detections. Recording a baseline is
not a waiver of those misses.

## Observed results on these selected excerpts

| Measure | Result |
| --- | ---: |
| Repositories / decisions | 8 / 16 |
| True positive / false positive | 5 / 0 |
| False negative / true negative | 3 / 8 |
| Correct decisions | 13 / 16 (81.25%) |
| Repositories with both decisions correct | 5 / 8 (62.5%) |

The three missed identity signals are a package's own name `@sveltejs/kit`,
a .NET SDK version in `global.json`, and a Flutter package's own name in
`pubspec.yaml`. They are recorded as false negatives, not relabeled to make the
score look better. The project-level Wilson interval in the JSON report is
an illustration of uncertainty from eight projects, **not** an estimate for
all public repositories: this selection is small and nonrandom. Decisions
within a repository are paired, so a decision-level confidence interval would
be misleading.

The samples cover only manifest-excerpt technology identity. They do not
measure security, browser support, full-repository recall, giant ZIP scanning,
or overall UCE accuracy. Labels were authored and reviewed by an agent; a
second independent human reviewer has not adjudicated them. The report keeps
`globalAccuracy: null` and `humanReviewedCases: 0`. A subsequent independently
reviewed, repository-level evaluation is required before a general accuracy
percentage can be published.
