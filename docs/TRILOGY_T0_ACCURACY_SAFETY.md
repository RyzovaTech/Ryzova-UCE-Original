# Trilogy T0 — UCE Accuracy Baseline & Developer Safety Foundation

**Status:** isolated, opt-in, read-only development experiment. No scoring changes, no production UI flag, no MCP interface, no native solver execution, no patch generation, no merge authorization.

## Goal

UCE findings should improve developer decisions rather than encourage destructive, overconfident edits. T0 establishes reproducibility, evidence provenance and safety expectations **before** claiming that independent Trilogy reasoning improves detection.

### What T0 actually measures

- Re-runs the original trusted UCE analyzer on three small, authored static-contract fixture repositories (TypeScript, Python and browser) with precisely captured source SHA-256.
- Checks exact canonical score, categories and raw issues are unchanged by a separate T0 safety evaluation; compares deterministic evidence fingerprints across repeated scans while excluding report IDs, timestamps and benchmark timing.
- Tracks partial coverage, failed rules, budget truncation, issue-file provenance and whether a report can legitimately display a numeric static-score. Even a 100/100 score is **not** a runtime certification.
- Produces an opt-in machine-readable `trilogy-t0-report.json` and explicit *null* independent accuracy, precision, recall, false-positive, false-negative and recommendation-correctness metrics.
- Verifies the pre-existing bounded authored/source-excerpt benchmark source SHA against `testing/accuracy/baseline.json`. The existing authored tests and their previously recorded 100% scope results are **not** independently blinded whole-project accuracy.

### What T0 cannot yet measure

- Independent real-world precision/recall or false-positive/false-negative rates (no independent blinded labels: [#80](https://github.com/RyzovaTech/Ryzova-UCE-Original/issues/80)).
- A complete whole-repository false-negative rate, builds, install behavior, runtime behavior or actual safety of proposed repairs.
- Safety of native Soufflé/Z3/cvc5 process-tree isolation ([#77](https://github.com/RyzovaTech/Ryzova-UCE-Original/issues/77)) or accepted kernel-backed memory/latency ([#81](https://github.com/RyzovaTech/Ryzova-UCE-Original/issues/81)).

### Reproduction

```sh
npm ci
node --test testing/trilogy-t0/*.test.mjs
node testing/trilogy-t0/run.mjs --output=trilogy-t0-report.json
npm run audit:accuracy:baseline
npm run test:report-regressions
```

CI runs the standalone T0 suite and uploads the JSON artifact. The ordinary analysis code, native UCE scoring and source project files are untouched. No accuracy metric is filled by synthetic/author-provisional labels, and no automatic fixes are authorized.

### Next increment (T1)

With a committed frozen input/evidence contract, introduce typed evidence adjudication states: `source-referenced`, `independently-checked-in-scope`, `disputed`, and `unknown`. Evidence must not promote a report's global score or trigger a patch automatically. Prospective human review remains separate from authored regression fixtures.
