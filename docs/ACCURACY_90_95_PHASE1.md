# 90–95% accuracy program: Phase 1 measurement foundation

This change extends the existing accuracy program rather than resetting its
history or treating prior passing development tests as independent validation.
No detector thresholds or rules were tuned against the evaluation collection.

## Delivered engineering work

- Frozen, offline scope-contract corpus: 150 binary decisions, with 36 positive
  and 114 negative labels. Includes web, backend, Python, Java, Go, Rust, PHP,
  Ruby, Flutter mobile, Electron desktop, PyTorch AI/ML and CMake systems inputs.
- Production/configuration, nested monorepo paths, tests, examples/fixtures,
  vendor, generated output and documentation are evaluated separately.
- Six security review-signal families include executable calls, clean alternatives
  and comments. A signal label is not an adjudicated exploit or vulnerability.
- Scope classification is measured separately from detection and independently
  protected against regression. Cases and labels are checksum protected.
- Shared confusion-matrix metrics separate boolean detection labels from
  categorical package-manager labels, reject unknown/malformed decisions,
  and report sample counts plus Wilson intervals. No denominator means null,
  not 100%. Existing development reports now include ecosystem breakdowns.
- All three regression gates validate decision IDs and expected labels as well
  as the corpus checksum. Existing failures remain visible; newly failing prior
  passes block CI. Scope contracts and metric tests run in CI.

## Reproduction

```sh
npm run test:accuracy-metrics
npm run audit:accuracy
npm run audit:accuracy:baseline
npm run audit:accuracy:holdout
npm run audit:accuracy:scopes
```

Use `node testing/accuracy/scope.mjs --output` to export the current scope report.
Use `--record` only for reviewed corpus changes or to protect a verified
improvement. Inspect every failure before recording; do not overwrite a baseline
simply to make CI green. The full report retains every decision for triage.

The new contracts pass 150/150 at this commit. Precision and recall are both
100% on this synthetic development corpus, with 36 positive examples. Their
Wilson intervals are approximately 90.36–100%. Repeated scope variants are
correlated, so those decision-level intervals do not establish project-level or
worldwide performance. The 150 scope classifications also pass.

## Review and evaluation boundaries

All new labels are agent-provisional; independent human-reviewed count is zero.
The existing pinned manifest collection remains repository-separated from the
existing development collection. It has already been evaluated in earlier work,
so it must not be described as a fresh blind holdout for future tuning.
Keep synthetic scope cases in development, never count their templates as real
repositories, and preserve upstream provenance/licensing in existing excerpts.

Before a release accuracy claim, collect a fresh repository-separated blind
sample with immutable provenance and complete scan boundaries. Review labels
from source intent before running UCE, then obtain independent adjudication.
Ambiguous findings remain unreviewed, not negative. Measure supported modules
and ecosystems separately, including positive and negative examples for each.

The release objectives are precision >=95% and recall >=90% on the stated
supported benchmark. Those targets are not enforcement gates yet: Phase 1
establishes measurements and regression protection, not demonstrated broad
accuracy. Whole-project security recall, source-to-sink validity, unsupported
modules and independently adjudicated real-world accuracy remain unmeasured.
A global UCE accuracy value therefore remains null. Phase 1 engineering is
complete; independent label adjudication and blind release validation are pending.
