# Phase 1 — compatibility rule-execution reliability

Status: isolated review branch; no production deployment. This change addresses caught exceptions in the classic deterministic compatibility rule engine. It does not change rule detectors, rule severities, V3 rule packs, or normal successful scoring.

## Failure contract

- Every unexpected exception from an applicable classic compatibility rule records `summary.scanStats.ruleFailures[]` with its trusted `ruleId`, `category`, and `kind: "exception"`. Raw error text, exception stack traces, and scanned source are **not** included in the diagnostic.
- Findings already produced by successful rules remain in the canonical `issues` array.
- A category with an execution failure has `status: "unknown"`, `score: 0` as an inapplicable placeholder, and a summary describing observed issues and incomplete evaluation. It is excluded from weighted scoring. No execution failure is counted as a project defect.
- The report is marked `analysisCoverage.status: "partial"`, with an explicit failure reason. `scanStats.truncated` is set to prevent old clients and downstream readiness checks from treating an incomplete report as complete.
- `describeReportReadiness()` returns `displayScore: null`; the report page and saved-report lists do not present the numeric `score.overall` as a validated readiness score. A raw numeric score is still retained in JSON for backward-compatible computation and comparisons **only within its assessed categories**.
- `uce:ci` rejects reports containing rule execution failures even when `--min-score=0`; malformed failure diagnostics reject as invalid input. Existing historical reports without the optional field remain valid.
- Archive batch coverage retains the failure status when finalizing a large scan, including after incremental source analysis and checkpoints.

## Reproduce

```sh
npm ci
npm run test:report-regressions
npm run check
npm run build
npm run uce:ci -- testing/fixtures/phase5/ci-pass-report.json --min-score=80 --max-critical=0
```

The regression suite deliberately injects a failing rule, verifies its recorded provenance, ensures retained successful findings, verifies partial readiness and markdown handling, and spawns the real CLI to reject a contrived numeric score of 100 with unresolved rule failures. Successful rule behavior and existing score weights remain unchanged.

## Explicit limits

This protects the **classic compatibility rules** exception boundary. Uncaught failures in other analysis modules already abort the analysis rather than pretending success, but are outside this change. A numeric score does not prove build or runtime compatibility. Browser, CLI and report consumers must respect the partial and unknown status. Merging requires green CI plus human review; this documentation is not a claim of deployment or independent accuracy validation.
