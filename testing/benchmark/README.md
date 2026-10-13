# Evidence benchmark: 95% precision and recall program

Run `npm run audit:benchmark` or `node testing/benchmark/run.mjs --check --output=report.json`.
Run `npm run test:benchmark` to test the evaluator itself. CI uploads the evidence report alongside release-validation results.

## What this measures

The initial development corpus has 21 labeled decisions across seven compatibility rules and six ecosystems. Each family has a bug/policy-trigger case, its fixed counterpart, and a similar negative case. Every case stores actual file contents, exact evidence lines, a rationale, expected finding ID, and label status. These are synthetic, agent-provisional rule-context contracts. They are NOT 21 independently verified repository defects and are NOT a blind holdout.

The evaluator validates the entire corpus before invoking detectors, hashes the corpus and file contents, preserves emitted findings, and reports TP/FP/FN/TN, precision/recall, Wilson intervals, per-rule/ecosystem metrics and prioritized failures. Only the explicitly labeled finding is scored. Unlabeled findings remain visible, never become invented true negatives, and require separate adjudication. Correlated variants are not independent statistical samples; intervals are descriptive and do not certify generalization.

`--check` fails for any labeled mismatch. `--require-95` always fails for this development corpus, even if all cases pass. The release policy now requires both precision and recall >=95% instead of accepting 90% recall. Engineering CI passing does not mean an accuracy claim is authorized.

## First measured repair

Before the .NET repair, this fixed set produced TP=7, FP=2, FN=0, TN=12 (precision 77.78%, recall 100%). The failing cases were `dotnet-target-fixed` (inherited target) and `dotnet-target-negative` (auxiliary project selected). After repair: TP=7, FP=0, FN=0, TN=14. This is 100% on these 21 selected contracts, NOT 100% or 95% UCE accuracy. Recall's descriptive 95% Wilson interval is only 64.57–100%; per-rule evidence is smaller still.

The .NET check inspects production projects, recognizes nonempty modern and legacy targets, removes XML comments, and checks nearest ancestor Directory.Build.props/targets. It does not execute MSBuild, resolve arbitrary imports, evaluate conditions/property expressions or prove SDK defaults. Unread metadata/dynamic imports cause abstention from the missing-target warning, not a clean-build guarantee. Conditional or overridden declarations still require effective-build review.

MSBuild evidence reference: https://learn.microsoft.com/en-us/visualstudio/msbuild/customize-by-directory

## Route to independently measured 95%+

1. Use this development suite to expose and repair defects; retain every negative case.
2. Build real-repository bug/fixed pairs with immutable repository commit SHAs, licensed excerpts, affected locations and compiler/test/manifest evidence. No running arbitrary upstream code in the benchmark process.
3. Have an independent reviewer adjudicate labels and disagreements before measuring the claim. Do not derive expected labels from UCE output.
4. Reserve fresh repository families outside all development corpora, including the 100 repositories in `testing/repositories/selection.json`. The existing pinned manifest suites have been observed during development and are not a fresh blind evaluation.
5. Evaluate full engine output and coverage per module/ecosystem, including unknown/unread inputs, false negatives, critical severity and correlated project-level results. Never pool synthetic contracts with selected manifest metrics to imply whole-project recall.
6. Require >=95% precision and recall on the declared scope, sufficient independent samples and confidence bounds, plus separate critical-finding review. A 99% critical precision target is not established by this corpus.

Independent adjudication and a fresh full-repository holdout are outstanding. No overall accuracy percentage is established by this change.
