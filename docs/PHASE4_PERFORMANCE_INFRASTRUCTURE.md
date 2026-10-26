# Phase 4 — Performance and Infrastructure Hardening

**Scope:** Stacked on PR #92 (Phases 1–3). No production merge or manual deployment until final owner approval following all planned phases.

## Changes

1. **Cache collision hardening:** Bump `ANALYSIS_CACHE_VERSION` to 24. The prior key used a single 32-bit FNV hash. The new length-framed, four-lane, 128-bit non-cryptographic fingerprint includes source, project identity, inventory/coverage, archive signature, ignored scope, sorted file names, sizes, directory/content presence and full source text. A real legacy hash collision fixture proves that inputs producing identical old keys now generate different new keys. This is for accidental-collision reduction, **not cryptographic verification or adversarial tamper resistance**.
2. **Deterministic selection:** Selected files, directories and cache fingerprinting use stable path ordering independent of OS locale and archive enumeration order. Existing file/content resource budgets remain.
3. **Fail-safe reuse:** Sampled, truncated, incomplete archive sweep, rule-execution-error, security-truncated and V3-truncated reports cannot enter or be reused from local cache. Source reports and scoring weights remain unchanged.
4. **Storage bounds:** Reports larger than 4 MiB UTF-8 are excluded from memory and session caches; normal report-history handling remains available. A maximum of five entries, correct eviction of stale persisted keys and hot-memory LRU promotion avoid silent cache growth.
5. **Worker metadata:** `execution.worker` now describes actual invocation: false for synchronous fallback and cache reads, true for a real Worker execution. User-visible completion text matches this distinction.
6. **Reproducible CI:** Full CI uses lockfile-respecting `npm ci`. Add bounded 25,001-entry real ZIP archive batch benchmark alongside the existing V3 memory benchmark, with no thresholds disabled or relaxed.

## Acceptance

- `testing/report/phase4-execution-integrity.test.mjs` verifies known old collisions, input scope, ordering, partial/cache refusal, worker metadata, bounded memory and stale eviction.
- Full typecheck, lint, build, static accuracy, security and regression suites, V3 memory, 25,001-file archive ZIP batch tests and three-browser E2E must pass on the exact HEAD.
- Native UCE score weights, V3 rule packs, upload/network behavior and feature flags are not modified.
- Manual high-zoom, screen-reader, real-device accessibility and owner approval remain final release gates; no staging merge or manual deployment in Phase 4.
- This is a bounded and non-cryptographic cache, not proof of collision immunity, runtime compatibility or arbitrary device-memory safety.
