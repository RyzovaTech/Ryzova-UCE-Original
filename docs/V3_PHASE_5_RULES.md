# UCE V3 Phase 5 — Rule inventory and release status

Phase 5 adds 1,000 executable npm version-declaration review rules over 250 distinct packages from 13 ecosystem areas. The built-in V3 inventory is now 10,000 active rules in 45 packs. See the [generated Phase 5 index](generated/V3_PHASE5_RULES.md).

The four new policies flag unresolved placeholders, Git branch dependencies, floating npm aliases, and wildcard patch declarations. These are reproducibility and compatibility **review signals**. They do not claim that a dependency is vulnerable, that a specific version is unsupported, or that runtime behavior is broken. Existing Phase 3 migration and Phase 4 cross-file correlation rules remain available. Organization packs, explicit community pack import and Ed25519 signature verification continue to use the V3 registry.

## Validation evidence

- All 10,000 rules must have unique IDs and detector signatures and pass the V3 pack validator. No bounded regex-only security rule may claim critical severity.
- Each new Phase 5 rule runs against a generated positive dependency manifest, a pinned-version negative manifest, and an excluded test-scope manifest. These are **3,000 executable fixture assertions for the 1,000 new rules**.
- The repository suite, schema gate, self-scan and benchmark are checked as separate quality gates. Scan output includes SARIF through the existing CLI.
- SARIF now includes V3 findings alongside legacy findings. The repository self-scan warning gate allows 80 review signals instead of 50 because V3 signals are now counted; it still requires zero critical findings. Inspect those warnings before treating the scan as security clearance.

## V3 Stable gate is still open

The Phase 5 inventory milestone is distinct from the V3 Stable release milestone. The prior 9,000 rules do **not** yet have demonstrated positive, negative, and scope fixtures for every rule. The requested minimum of 30,000 such assertions across all 10,000 rules has therefore **not been met**. Browser memory regression runs and live pull-request annotation verification also require release validation. Do not market this inventory milestone as V3 Stable.
