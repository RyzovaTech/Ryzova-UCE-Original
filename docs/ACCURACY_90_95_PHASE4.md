# Phase 4: package-local version and configuration reasoning

This phase strengthens cross-file configuration evidence and version reasoning. It adds bounded Node runtime/engine correlation and improves the existing V3 manifest-lockfile and module-configuration rules. It does not claim full semantic API misuse detection or inter-file taint analysis.

## Delivered behavior

- Compare stable numeric version intervals instead of the first number or string equality. Supported forms: exact and partial versions, `v` prefix, caret, tilde, wildcards, comparison intersections and `||` alternatives. A conflict requires disjoint intervals. A partial runtime pin that overlaps the engine requirement stays unreported.
- Unsupported forms, prereleases, build metadata, aliases, git/workspace URLs, hyphen ranges, malformed values and contradictory requirements remain unknown. The reader accepts at most 256 characters, eight alternatives and eight comparator tokens per alternative. It is intentionally not a complete npm semver resolver.
- Add a compatibility rule for same-directory `package.json` engines.node versus `.nvmrc`, `.node-version` and explicit official Node Dockerfile FROM selections. Comments, arbitrary images, dynamic tags and sibling package selections cannot establish a conflict. Both evidence files and the selected line are included in the warning. Docker stages are review signals; this does not prove which stage executes the application.
- V3 lockfile rules now evaluate supported ranges against a concrete stable installed version, using the package-local lock only. Reject arrays, invalid entries, linked entries and prerelease entries. Existing v1 dependency entries and v2/v3 package maps are supported; workspace hoisting and absent direct entries are unmeasured.
- npm lock corroboration also requires a compatible supported installed version, so an incompatible lock entry cannot increase technology confidence. Unknown version forms do not corroborate.
- The built-in module-pair rule uses explicit `node-module-typescript` semantics: root package type plus `compilerOptions.module`. TypeScript JSONC comments/trailing commas are supported. Nested prose, noEmit, declaration-only output, malformed option values and unresolved extends do not establish an emitting CommonJS conflict. A matched pair remains review-required, not a demonstrated runtime failure. Package boundaries include malformed manifests so siblings cannot borrow evidence.
- Generic custom paired-evidence rules retain their declared regex behavior; the semantic option is documented in types/schema and validated. Phase 4 packs advance to 3.3.1, active V3 IDs/count remain 10,000, analysis cache advances to 17.

## Measurements and reproduction

The frozen development corpus has 56 synthetic decisions: 18 lock, 17 module and 21 runtime contracts. New runtime coverage did not exist in the parent; its parent result is recorded as no signal rather than presented as a regression of a previous implementation.

| Development measurement | Phase 3 parent | Phase 4 |
| --- | ---: | ---: |
| Correct decisions | 40/56 | 56/56 |
| True positives | 3 | 13 |
| False positives | 6 | 0 |
| False negatives | 10 | 0 |
| True negatives | 37 | 43 |

The 35 existing lock/module contracts improve from 24/35 to 35/35. All labels are agent-provisional and were used during implementation; independently human-reviewed count is zero. Precision/recall on the selected 13 positives are 100%, with a Wilson 95% interval of 77.19–100%. **Global 90–95% UCE accuracy is still unverified.** These contracts do not measure real-project security recall or whole-module correctness.

The parent source is `280d6bab8bcf37c9a28ae3ca53d86fff6d6716bc`. Full corpus and before/after decisions are in `testing/correlation/`. Use:

```sh
npm run test:correlation
npm run audit:accuracy:correlation
```

The audit checks corpus checksum, IDs and labels against the committed baseline and rejects any failing decision. Record a baseline only after examining every changed result. Eight focused test groups additionally cover interval boundaries, unsupported forms, runtime provenance, lock confidence and package ownership. CI runs both new commands.

Local verification: build/typecheck/lint, 904 knowledge checks, 30,000 V3 fixture assertions, Phase 2 evidence and Phase 3 security regressions, existing accuracy audits, schema/trust gates, production dependency audit (zero vulnerabilities), performance (~4.8s/30s), memory (48 MiB/384 MiB) and self-scan (score 95, critical 0). The CommonJS fixture now supplies a structured config rather than a standalone regex witness.

## Remaining boundaries

No release accuracy claim follows from passing development contracts. Independent real-repository adjudication remains required. Cross-file security flows, sanitizer trust, binding resolution, inherited TypeScript options, framework API misuse and arbitrary ecosystem version solvers remain future work. Existing sampled-analysis/truncation labels remain applicable: absence of a correlation signal is not proof of compatibility. This phase completes the bounded version/configuration engineering work described above.
