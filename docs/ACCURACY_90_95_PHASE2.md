# 90–95% accuracy program: Phase 2 declaration and import evidence

## Implemented

- Valid structured npm dependency declarations and framework-owned package
  identity (name plus version). Reject arrays, object/boolean/null dependency
  versions, malformed JSON and prose-only references.
- Table-scoped Python/Cargo identity, Go module identity and Composer identity.
  TOML comments and multiline descriptions cannot impersonate package metadata.
- Built-in Python, Go, Cargo and Composer framework signals use dependency
  declarations instead of arbitrary manifest text. Cargo aliases and dependency
  scope are retained by the existing reader.
- .NET SDK identity from a valid `global.json` SDK version, and Flutter SDK
  mappings from dependency/dev-dependency blocks, including framework-owned
  `sky_engine` and Flutter testing dependencies. A package called Flutter or a
  prose keyword alone is insufficient.
- Actual Acorn JavaScript AST import/re-export/literal dynamic-import evidence.
  Comments, strings, regex literals, computed imports, relative imports and
  invalid syntax cannot supply literal package-import evidence.
- Matching npm lock root declarations and installed entries corroborate a
  package-local declaration. Orphan locks, stale root ranges, malformed locks
  exact version disagreements and sibling package locks cannot invent or corroborate that package's stack.
- Confidence combines evidence kinds within the nearest manifest boundary.
  Evidence from sibling packages remains visible but cannot inflate confidence
  through a cross-package combination. Repeated same-kind signals remain capped.
- V3 Go dependency reading now understands `require` lines and blocks instead
  of treating module names/comments as dependencies. Generated fixtures now
  supply proper Go directive structures and use the declared ecosystem in
  multi-detector fixtures.
- Analysis cache version increases from 14 to 15; old reports are not reused.
  CI runs `npm run test:evidence` alongside all existing gates.

## Measured results

The unchanged selected-manifest collection improves from TP=5, FN=3, TN=8,
FP=0 to TP=8, FN=0, TN=8, FP=0: recall 62.5% -> 100%, decision accuracy
81.25% -> 100%, on only 16 decisions across eight repository excerpts.
Failures fixed: SvelteKit package identity, .NET SDK metadata and Flutter SDK
mapping. Expectations and corpus checksum are unchanged. The baseline is
recorded after verifying the fixes so future regressions are blocked.

This collection has been used to diagnose and verify these fixes, so it is
now a development regression set, not a fresh blind accuracy test. Eight of
eight projects passing gives a project Wilson interval of about 67.56–100%.
Independent human adjudication remains pending. These numbers do not establish
90–95% global UCE accuracy, security recall or accuracy on full repositories.

The existing 248 development decisions and 150 scope decisions remain passing.
Twelve additional evidence test groups cover declarations, scope, AST inputs,
monorepo ownership, lock mismatches and counterexamples. All 10,000 V3 rules
retain three execution assertions each (30,000 total). Typecheck, lint, build,
schema/trust gates, performance/memory budgets, production dependency audit and
security self-scan are required before merging.

## Boundaries and next phases

AST evidence currently covers standard `.js`, `.mjs` and `.cjs` ES imports,
not TypeScript/JSX, CommonJS require binding analysis, variable resolution or
source-to-sink security proof. Files over 256 KiB, unsupported/invalid syntax,
and AST walks over 50,000 nodes provide no AST import evidence. Declaration
signals still apply; absence of AST evidence is not proof of absence.

Lock corroboration is npm lockfile v2/v3 package-map structure with a matching
root declaration and a concrete installed version. It does not solve semver
ranges, certify installation correctness, resolve hoisting, or replace the
existing lockfile conflict rules. YAML/TOML readers are bounded readers for the
listed common declaration forms, not arbitrary full-language parsers. Other
registry signatures and V3 language AST adapters retain their prior limitations.

Full framework API misuse, version-specific semantic compatibility, inter-file
flows and cross-file conflict reasoning belong to Phase 4. Phase 3 can now focus
on noisy rule families and a larger independently labeled negative corpus.
