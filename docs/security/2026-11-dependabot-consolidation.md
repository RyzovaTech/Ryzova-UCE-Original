# UCE — November 2026 dependency alert remediation

Purpose: consolidate the already-open Dependabot fixes for [#43](https://github.com/RyzovaTech/Ryzova-UCE-Original/pull/43) (brace-expansion), [#49](https://github.com/RyzovaTech/Ryzova-UCE-Original/pull/49) (source-map-js), and [#68](https://github.com/RyzovaTech/Ryzova-UCE-Original/pull/68) (Vite) without touching compatibility rules or accuracy benchmarks.

## Lockfile/provenance

- Vite direct declaration `^8.2.2` -> `^8.3.5` from Dependabot #68.
- `vite` lock entry `8.2.2` -> `8.3.5` from #68, with its compatible Rolldown, Oxc, PostCSS, nanoid and source-map-js transitive updates.
- `source-map-js` `1.2.1` -> `1.2.2`, already included in Dependabot #68 and independently supported by #49.
- `brace-expansion` nested `5.0.9` -> `5.0.12`, legacy `1.1.18` -> `1.1.21`, copying the exact registry URL and sha512 integrity from Dependabot #43.
- No unapproved lockfile package entries changed relative to #68 except those two brace-expansion entries. npm lockfile JSON regenerated only for consistent formatting.

## Verification / release gates

1. `npm ci --no-audit --no-fund` must pass on GitHub Actions.
2. `npm run test:security-deps` asserts patched versions and lock integrity (offline, deterministic).
3. Existing `npm run check`, build, regression, security contextual tests, accuracy/holdout/oracle/benchmark and self-scan remain unchanged.
4. CI now runs `npm audit --audit-level=high` (including devDependencies), replacing production-only `npm audit --omit=dev`. This may surface *additional* unrelated vulnerabilities; investigate rather than disabling the gate or claiming zero exposure.
5. After green checks, independently check that Dependabot advisories clear in GitHub's **Security > Dependabot alerts**. A clean CI cannot by itself certify every dependency/runtime path or that alerts were closed.
6. Do not merge or deploy to production until CI and npm security audit pass. Avoid repeated quota-consuming Vercel deployments. No changes to paid tiers, CLI analysis evidence, deterministic rules, or public repository import behavior.

This is a narrowly scoped dependency-risk stabilization, not an accuracy or runtime correctness certification.
