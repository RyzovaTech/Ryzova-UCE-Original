# Accuracy Phase 2: context and false-positive controls

Phase 2 narrows security findings to evidence that belongs to the rule's domain.
The versioned security knowledge pack is `4.2.0`; the analysis cache version is
`13`, so cached results made with the older rule semantics are not reused.

## Changes

- Security scans classify `unittests` and `*-selftest` directories as tests. The
  53 URL findings from the pinned Linux report all fall under those paths.
- SEC005 requires an outbound network call or an explicit endpoint setting.
  Documentation links and schema identifiers are not treated as network use.
- SEC014 excludes debugger command calls and requires SQL syntax or a database
  receiver. It also recognizes Python SQL f-strings.
- SEC025 applies to JavaScript/TypeScript HTTP cookie APIs and reports when
  either Secure or HttpOnly is absent. Native kernel cookies are unrelated.
- SEC028 requires a password near an actual general-purpose hash API call;
  assigning a legacy algorithm identifier is not called password hashing.
- SEC038 does not label native NVMe transport initialization as database TLS.
  Remaining service TLS settings require deployment review.
- SEC039 requires an apparent file creation call, filters explicit exclusive
  creation, and remains informational/review-required because file ownership
  and races cannot be established from a path literal alone.
- Comment-context filtering now applies to every registered security rule.

## Reproducible measurement

`npm run audit:accuracy:baseline` checks 248 selected decisions. The 25
security decisions have TP=10, TN=15, FP=0 and FN=0 in this **development
corpus**. They include three newly pinned Linux excerpts and independent
synthetic positive and negative controls. They do not measure full-project
recall, worldwide accuracy, or every possible language and framework.

The original Linux report still has 79 recorded alerts. The triage file now
marks 53 schema self-test alerts out of production scope and four rule-domain
false positives after agent source review. The other 22 remain unreviewed;
there is no claim that they are safe. The archive's exact source commit was
not recorded by the original scan. Pinned excerpts are from a later source
review, and rerunning the entire large archive remains necessary to measure
the new report's actual issue count.

The corpus and labels are agent-reviewed development data. Independent human
adjudication and a held-out repository-level sample are still needed before
publishing a general accuracy percentage. Static pattern findings are review
signals, not proof of exploitability or comprehensive absence of risk.
