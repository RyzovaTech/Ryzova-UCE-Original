# Phase 5: reproducible release validation and accuracy-claim boundaries

The five-phase engineering program is complete within the bounded implementations described in the Phase 1–4 documents. Independent adjudication and broad real-project accuracy validation remain pending. Completing these engineering phases does not demonstrate global 90–95% accuracy.

## Delivered

- Eight new public repositories, separated case-insensitively from both the existing development corpus and previous pinned collection. Each selected manifest has an immutable commit, source URL, upstream full-file SHA-256, license, excerpt method and positive/negative rationale. Upstream license texts and attribution are retained in `testing/release/`.
- Labels were authored from source before the first detector run. No engine rules or confidence thresholds were changed for this collection. After its first evaluation, it is used as a provisional pinned regression collection; it is not represented as independently human-reviewed or a continuing blind holdout.
- Strict provenance/label validation rejects overlapping repositories, unsafe/duplicate paths, unpinned commits, missing license/source metadata, incomplete positive/negative pairs and duplicate decisions.
- Shared regression protection now rejects duplicate current IDs, malformed labels and pass flags inconsistent with the actual decision. Baseline checksum/label identity checks remain in place.
- A consolidated runner executes seven separate accuracy suites with their own regression checks and blocks any unresolved decision. Reports retain separate sample counts, metrics and scopes; no pooled global accuracy is calculated.
- Accuracy claim readiness fails closed on incomplete independent review, blind evaluation, full-repository boundaries, sample size, target metrics and module coverage. Eligibility is only for manual benchmark review; globalAccuracy remains null and no automated global claim is produced. Boolean evidence flags require actual booleans.
- CI runs release-readiness tests and uploads `uce-accuracy-release.json` with existing analysis artifacts. This adds validation/reporting only; the engine cache and rule versions remain at their Phase 4 values.

## Current measured contracts

| Suite | Correct decisions | Meaning |
| --- | ---: | --- |
| Bounded development | 30/30 | Synthetic detector/inventory contracts |
| Mixed development | 248/248 | Existing selected development inputs |
| Scope development | 150/150 | Production and auxiliary-scope detection contracts |
| Security context | 140/140 | Synthetic security review-signal contracts |
| Configuration correlation | 56/56 | Synthetic package-local configuration contracts |
| Previous pinned manifests | 16/16 | Eight reused public repository excerpts |
| New pinned manifests | 16/16 | Eight new public repository excerpts |

Scope classification also passes 150/150 separately. These sets are not merged into a global denominator. Manifest absence labels apply only to the selected excerpt, not the entire upstream repository.

New collection: pallets/click, psf/requests, fastapi/fastapi, denoland/deno, prometheus/prometheus, symfony/symfony, vercel/next.js and vuejs/core. Coverage: selected Python, Rust, Go, PHP and JavaScript manifest identities. TP=8, FP=0, FN=0, TN=8. All eight projects pass both decisions. Their project-pass Wilson 95% interval is 67.56–100%; the selection is small and nonrandom, so it is not a worldwide estimate. Independent human-reviewed count is zero.

Eight release-validation test groups and five metric test groups protect the policy and provenance behavior. Existing validation passes: 904 knowledge checks, 30,000 V3 rule assertions, Phase 2/3/4 regression groups, typecheck/lint/build, schema/trust gates, performance (~4.7s/30s), memory (45 MiB/384 MiB), production dependency audit (zero vulnerabilities) and self-scan (score 95, critical 0).

## Reproduce

```sh
npm run test:release-validation
npm run test:accuracy-metrics
npm run audit:accuracy:manifest-validation
npm run audit:accuracy:release
node testing/release/run.mjs --output=uce-accuracy-release.json
```

The default command verifies engineering regression gates. `node testing/release/run.mjs --require-claim-ready` additionally rejects an unsupported claim with exit code 2; that is the expected current outcome. Failed regression/provenance checks exit nonzero independently. CI deliberately enforces engineering validation while retaining accuracy claim status `not-established` in its artifact.

Starter policy requires at least 30 independently selected repositories, 50 positive and 50 negative decisions, independently verified adjudication of every decision, a fresh blind evaluation, verified full-repository scan boundaries, technology/security/compatibility coverage and precision >=95% / recall >=90% on the specified supported benchmark. These minimums are an engineering review policy, not a statistical guarantee. A qualified human must verify review independence, module sampling and scan completeness; setting metadata is not proof.

The remaining work is real-project collection/adjudication across supported modules and ecosystems, with sampling and scan boundaries verified. Cross-file taint, API semantics and unsupported language/version forms remain bounded as documented in Phase 4. No new overall accuracy percentage is published by this phase.
