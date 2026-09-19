# UCE V3 Rule Platform

UCE V3 introduces executable, versioned knowledge packs while preserving the V2
report contract. A pack can add rules without editing the analyzer core.

## Contract

- JSON Schema: `schemas/v3-rule-pack.schema.json`
- Runtime types: `src/lib/knowledge/v3-types.ts`
- Validation and graph checks: `v3-validator.ts`
- Bounded detector execution: `v3-sdk.ts`
- Lazy loading and organization packs: `v3-registry.ts`
- Ed25519 trust verification: `v3-signatures.ts`
- Markdown generation: `v3-docs.ts`
- Built-in registration boundary: `v3-default-packs.ts`

Five declarative detector adapters are available: regex, AST signature, manifest,
dependency, and configuration. AST signatures are deliberately static and bounded;
future parser adapters can implement the same contract without changing rule packs.

## Safety and trust

Rules never execute scanned project code and cannot request network access. Every
rule has file, content, match, and time budgets. Imported unsigned packs remain
disabled unless an organization explicitly approves them. Pack signatures use a
canonical payload, SHA-256 digest, Ed25519 verification, publisher trust store, and
revocation flag.

## Adding a pack

1. Create a schema-v3 pack with globally namespaced rule IDs.
2. Validate it with `validateV3RulePack`.
3. Register inline with `registerPack`, or provide a `registerLazyPack` loader.
4. Add positive, negative, and scope fixtures for every rule.
5. Generate documentation with `generateV3RuleDocumentation`.

The registry rejects duplicate IDs, duplicate detector signatures, missing rule
dependencies, dependency cycles, and simultaneously enabled declared conflicts.
Built-in packs are added only to `v3-default-packs.ts`; the analyzer core does not
change when a new pack is introduced.
