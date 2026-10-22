# Trilogy Accuracy Validation — frozen semantic holdout v1

**Status: this is a separate held-out, authored synthetic evaluation, NOT
independent externally human-adjudicated or real-repository accuracy.**

The actual real Soufflé Datalog -> Z3 -> cvc5 pipeline runs against
40 frozen test cases in testing/trilogy/holdout-v1.json. Their labels,
witnesses and contradiction certificates are recorded independently of
solver predictions. These are not a random sample of user projects and were
created by the development agent, not external blind human reviewers.

## Labels and independent semantic certificates

- Conflict (14): explicit disjoint numeric semver ranges. One tricky case
  has a three-way disjunction with mutually intersecting pairs but no common
  element across all three. Certificates are checked separately using npm
  semver and finite alternatives, never solver output.
- Satisfiable (14): each predeclared witness is independently checked
  using npm semver.satisfies for every recorded reachable Node requirement.
- Unknown (12): unsupported, malformed, missing, out-of-scope or unresolvable
  lockfile/engine facts must result in an abstention, not an assumed proof.

Cases cover different major/minor boundaries, caret/OR expressions, zero-major
releases, cycles, scoped packages, unreachable contradictory packages,
sibling workspaces, stale lockfiles, missing resolutions, prereleases and
unsupported npm/workspace installation layouts.

## Metrics, with abstentions accounted for

Reference conflict is positive. Reference satisfiable is negative.

| Count | Reference truth | Predicted verdict |
|---|---|---|
| TP | conflict | conflict |
| FP | satisfiable | conflict |
| FN | conflict | satisfiable |
| TN | satisfiable | satisfiable |
| Abstained positive | conflict | unknown |
| Abstained negative | satisfiable | unknown |
| Unsupported assertions | unknown | conflict/satisfiable |

- **Conflict precision** = TP/(TP+FP); null for zero positive predictions.
- **Conservative recall** = TP/(TP+FN+abstainedPositive).
- **Recall on decided positives** = TP/(TP+FN) separately disclosed.
- **False-positive rate on decided negatives** = FP/(FP+TN).
- **All-labeled-negative FPR** = FP/(FP+TN+abstainedNegative). Not a conservative error upper bound: adding abstentions to the denominator can lower the apparent rate; always report the decided-negative FPR and coverage alongside it.
- **Known-label coverage** = all decided positive+negative / 28 known cases.
- **Selective accuracy** = (TP+TN)/known decided, null if none.
- Unknown-reference predictions are separately inspected for unjustified
  conflict and satisfiable assertions: they are not known negatives.

CI regression guard requires zero FP/FN, zero unsupported assertions,
all 12 reference Unknowns abstained, >=90% known-label coverage.
These synthetic regression gates do **not** guarantee population precision.

## Reproduce

On Ubuntu 24.04 with the documented Soufflé 2.5, Z3 5.2.0 and
cvc5 1.1.2 native dependencies installed:

    npm --prefix experiments/datalog-z3 run test:holdout-metrics
    npm --prefix experiments/datalog-z3 run audit:holdout

The runner writes testing/trilogy/reports/latest-holdout.json
(which is ignored by Git) and uploads it as a CI Actions artifact
named uce-trilogy-holdout-metrics even if a regression guard fails.
Each case exposes expected label, actual verdict and abstention separately.

## Next gate: genuinely independent real-repository review

Actual external real-repository precision, recall and false-positive rate
remain **unmeasured**. A future independent study should:

1. Freeze licensed/public pinned real repo snapshots with hashes for the
   relevant package manifest and lockfile, and predeclare sampling strata.
2. Obtain at least two blind human review labels per modeled Node requirement
   conflict, with witnesses or documented contradictions and adjudication of
   disagreement, without viewing solver output.
3. Preserve separate unknown/unsupported workspace, npm alias, nested,
   peer/optional and engine-strict semantics.
4. Keep independently reviewed holdout repos separate from development tests,
   then evaluate with TP/FP/FN/TN, unknown and abstention, by stratum.
5. Include uncertainty intervals and samples sizes; do not conflate
   modeled Node constraints with actual install/build/runtime compatibility.

No production web UI, browser WebAssembly, app scoring or deployment change
is part of this experiment.
