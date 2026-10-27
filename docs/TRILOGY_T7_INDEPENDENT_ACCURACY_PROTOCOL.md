# Trilogy T7 — Independent Accuracy Validation Protocol

**Status:** evaluator, blinding/reviewer data contract and negative-control CI are implemented. **No real-world independently adjudicated project accuracy has been measured. Release HOLD.** Draft PR #93 only. UCE scoring and original canonical findings are unchanged.

## Important distinction
The existing UCE source-excerpt benchmark labels are agent-authored/provisional. Its fixture result is not independent whole-repository accuracy. T0–T6 graph, literal, simulated native solver and review-only fix artifacts are **not real independent compatibility/vulnerability detections**. The current T7 CI purposely contains **no real-world truth labels** and returns \`measuredIndependentRealWorldAccuracy: null\` rather than claiming progress from synthetic accuracy scores.

## Preregister the real study before opening predictions

1. Independently sample a frozen real-repository source frame across runtime, security, browser, dependency, framework and deployment domains, with explicit inclusion/exclusion, positive and *negative/no-detection* claim units, ecosystems, severity, configuration and source-revision rules. Store exact verified Git commit IDs and SHA-256 source evidence digests; no secrets or private code in public artifacts.
2. Freeze a case-universe manifest with \`schemaVersion:1\`, \`studyId\`, \`protocolSha256\`, \`samplingFrameSha256\`, and \`cases\`. Each case has an opaque \`id\`, \`repositoryAlias\`, 40-hex \`commitSha\`, 64-hex \`sourceEvidenceSha256\`, \`domain\`, \`severity\`, and \`ecosystem\`. **Do not include expected labels in the case manifest**. Require external attestation of the source revision and sampling frame; merely entering valid hashes is not proof.
3. Independently blinded dual reviewers provide \`reviews.cases\` entries with \`caseId\`, exactly two distinct \`reviewerAlias\` values, \`blindToPredictions:true\`, each \`decision:positive|negative|unknown\`, \`evidenceSha256\` and \`rationaleSha256\`. A disagreement requires a third distinct blinded \`adjudicator\`; otherwise count as unresolved. A reviewer declaration is NOT authenticated independent human review; external oversight must verify identities, qualifications, blinding and source records.
4. Run **UCE-only** and **UCE+Trilogy** on the exact same frozen case universe. Each prediction is \`caseId,decision,scanComplete,commitSha,sourceEvidenceSha256\`. Include an entry for every case. Partial scans and \`unknown\` are **abstentions**, never true negatives. T4/T5 merely review source associations; do not silently map them to independent positive detector predictions.
5. Compute paired confusion counts TP/FP/TN/FN separately, strict recall with unknown positives in its denominator, alert precision, false-positive rate on decided negatives, false-alert incidence among all labeled negatives, decision coverage, abstention rate, Wilson95 descriptive intervals, and case-paired gained/lost detections and false alerts. Metrics are withheld entirely for missing paired/review case IDs; strata with fewer than 20 cases withhold percentages. Even on complete submitted data, outputs are marked *diagnostic-only*. Wilson95 does NOT account for repository-level case correlation. Independent clustered uncertainty review and preregistered thresholds are mandatory before scientific claims.
6. Recommendation correctness needs developer consent, independently reviewed source/patch preconditions, actual controlled clean install, builds/tests/deployment checks and rollback outcome. T6 emits only non-applied patch previews and cannot supply this evidence.

## Programmatic and CLI usage
\`testing/trilogy-t7/evaluate.mjs\` exports \`evaluateT7Study(manifest,reviews,uceOnly,ucePlusTrilogy)\`, validating source digest identity, reviewer aliases, missing data and bounded 2,000-case source scope. No project source executes.

For the current **intentionally empty independent study**:
\`\`\`sh
npm ci
node --test testing/trilogy-t7/*.test.mjs
node testing/trilogy-t7/run.mjs --output=trilogy-t7-report.json
\`\`\`

For later independently recruited locally stored cases (NEVER publish private reviewer/source data to CI):
\`\`\`sh
node testing/trilogy-t7/run.mjs \
  --manifest=/secure/t7/frozen.json \
  --reviews=/secure/t7/blinded-reviews.json \
  --baseline=/secure/t7/uce-only.json \
  --augmented=/secure/t7/uce-plus-trilogy.json \
  --output=/secure/t7/paired-descriptive.json
\`\`\`

## Honesty guard
Even with a fully populated, apparently perfect self-submitted study, the evaluator outputs \`independentlyAuthenticatedHumanCases:0\`, \`sourceGitCommitExternallyVerified:false\`, \`measuredIndependentRealWorldAccuracy:null\`, \`demonstratedTrilogyImprovement:false\`, \`recommendationCorrectness:null\`, and \`overallReleaseReady:false\`. Independent audit cannot be replaced by a user-controlled JSON flag or CodeQL. CI synthetic fixtures exercise the arithmetic and fail-closed guards only; the production claim path is **not unlocked**.

**Remaining gates:** real blinded representative accuracy/false-positive/negative labels (#80); signed source/commit provenance; real delegated native Soufflé/Z3/cvc5 end-to-end, process-tree plus disk/network/Windows controls (#77); realistic memory/perf (#81); developer reviewed actual safe fixes; owner release signoff. No browser/MCP release or production deploy from this phase.

**Additional denominators:** false-negative rate is available for *decided positive* labels as `falseNegativeRateDecided = FN / (TP+FN)`, separately from `missedPositiveIncidenceAllLabeledPositives = FN / (TP+FN+abstainPositive)` and `strictRecallIncludingUnknown = TP / (TP+FN+abstainPositive)`. These distinguish unrecognized positives from abstentions; neither abstention nor an unreviewed case is silently classified as a negative. All outputs remain unaudited diagnostic-only.

## Local Git object-chain source preflight (new experimental control)

Before asking independent reviewers to adjudicate cases, run the optional read-only, offline [T7 source provenance checker](TRILOGY_T7_SOURCE_PROVENANCE.md) against a frozen manifest and a separate private full-file Git source registry. It checks commit → tree → regular blob SHA-1 chain plus the manifest's SHA-256 digest, rejects missing or switched case identities and non-regular-file entries, and produces hash-only diagnostic evidence. Git checkout origin, real-world repository identity, representative sampling and blinded reviewer identities are **not** authenticated by this local checker. Do not use its successful result as proof of independent truth, real-world accuracy, production safety, or release readiness.

## Paired evaluation with same-process source integrity preflight

To bind local source object validation to the *same* frozen manifest used for paired UCE/Trilogy diagnostics, add `--registry` to the T7 CLI:

```sh
node testing/trilogy-t7/run.mjs \
  --manifest=/secure/t7/frozen.json \
  --reviews=/secure/t7/blinded-reviews.json \
  --baseline=/secure/t7/uce-only.json \
  --augmented=/secure/t7/uce-plus-trilogy.json \
  --registry=/secure/t7/local-source-registry.json \
  --output=/secure/t7/final-diagnostic.json
```

When registry is supplied, the CLI reads immutable Git commit/tree/blob objects again and checks full-file SHA-256; `study-integrity.mjs` then asserts identical study ID, case universe, commit and source-hash pins and report fingerprint. Mismatches **fail closed**. It does not accept an arbitrary user-submitted JSON audit as attestation. Without registry, `localSourceProvenance.status=not-performed` is explicit. The optional output file is created once with restrictive permissions and is never overwritten. Public CI uses only disposable synthetic Git fixture repositories.

The resulting `localSourceProvenance` remains **diagnostic-only**, with `independentlyAuthenticatedSourceRevisions=0` and `canCertifyRealWorldAccuracy=false`: local Git history can be counterfeited without independently verified repository origins. Declared reviewer labels and blinded flags are not independently authenticated. No local preflight can change `measuredIndependentRealWorldAccuracy:null`, `demonstratedTrilogyImprovement:false`, `overallReleaseReady:false`, or original UCE rules.

### Unresolved external evidence

The engineering harness can now enforce full paired case membership and locally pinned source bytes, but it cannot manufacture the missing independent real-project sample, two genuine blinded human adjudicators (and third-party disagreements), signed origin/reviewer provenance, sufficient domain-specific power, clustered uncertainty evaluation, native solver security acceptance or developer-validated remediation. These are explicit **release HOLD** conditions; do not call this a completed independent accuracy study without the real independent records and an owner decision.
