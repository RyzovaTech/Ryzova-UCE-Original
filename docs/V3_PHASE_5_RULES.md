# UCE V3 Phase 5 — Rule inventory and release status

Phase 5 adds 1,000 executable npm version-declaration review rules over 250 distinct packages from 13 ecosystem areas. The built-in V3 inventory is now 10,000 active rules in 45 packs. See the [generated Phase 5 index](generated/V3_PHASE5_RULES.md).

The four new policies flag unresolved placeholders, Git branch dependencies, floating npm aliases, and wildcard patch declarations. These are reproducibility and compatibility **review signals**. They do not claim that a dependency is vulnerable, that a specific version is unsupported, or that runtime behavior is broken. Existing Phase 3 migration and Phase 4 cross-file correlation rules remain available. Organization packs, explicit community pack import and Ed25519 signature verification continue to use the V3 registry.

## Validation evidence

- All 10,000 rules must have unique IDs and detector signatures and pass the V3 pack validator. No bounded regex-only security rule may claim critical severity.
- Every built-in V3 rule now runs against a positive, a negative, and an excluded test-scope case: **30,000 executable assertions for 10,000 rules**. The 7,000 single-package dependency cases use fixed version examples; browser, flow, import and regex checks use deterministic generated syntax witnesses. The fixture gate runs in CI.
- An additional corpus captures root `package.json` dependency declarations from **107 distinct public GitHub repositories**, with the repository name and source blob SHA. The regression suite checks a manually mapped framework dependency against its catalog rule and checks that an unrelated dependency does not trigger it. These are real manifest fragments, not complete source repositories; they chiefly cover the npm ecosystem.
- The V3 JSON Schema is checked against all 45 built-in packs, including three deliberately invalid examples. The repository suite, schema gate, self-scan and benchmarks run separately.
- The memory benchmark samples a synthetic 2,641-file project to 350 files with accurate truncation labels and enforces a 384 MiB post-scan Node heap budget plus a 30-second runtime budget. This is a Node simulation, not a Chrome heap profile.
- SARIF includes V3 findings; the pull-request workflow emits up to 25 inline GitHub annotations with locations and a pointer to the complete SARIF. A local CI-format fixture verifies the emitted annotation.
- SARIF now includes V3 findings alongside legacy findings. The repository self-scan warning gate allows 80 review signals instead of 50 because V3 signals are now counted; it still requires zero critical findings. Inspect those warnings before treating the scan as security clearance.

## Remaining independent release evidence

The 30,000 generated cases establish execution coverage, **not detection accuracy**: regex witnesses are derived from the rule definitions and do not independently establish real-world true-positive rates. The 107 real repository manifest fragments validate selected dependency detections, not a full multilingual project scan. The earlier 120-project corpus repeats twelve synthetic scenarios. A real Chrome heap regression during a large scan and a live GitHub pull-request annotation result remain necessary before claiming V3 Stable. Until independently verified, do not market the inventory milestone as a fully validated V3 Stable release.
