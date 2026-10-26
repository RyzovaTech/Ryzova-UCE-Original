# Trilogy T2 — Whole-Project Intelligence (experimental, accuracy-first)

**Branch:** Draft PR #93, stacked on T0/T1. **No merge, no automatic fixes, no production solver activation or change to UCE scoring.**

## What T2 implements

- Independent read-only **TypeScript AST extraction** (JavaScript/TypeScript import/re-export statements, literal `require` and dynamic imports). Only supplied source text is parsed; **never loaded or executed**.
- Safe local source-graph observations: exact relative paths, restricted deterministic TypeScript/JS candidate resolution and package-name evidence connecting local workspace manifests to imports. Relative references unresolved under unverified/partial inventories remain **Unknown**; even under an explicitly caller-asserted complete inventory, they are only **Review Required**, never a confirmed broken build.
- Same-workspace `package.json` `engines.node` versus explicit numeric `.nvmrc` / `.node-version` major version, using only a deliberately limited stable comparator subset; unsupported semver expressions are **Unknown**. A syntactically disjoint pair is **Review Required**, not evidence of runtime failure. This is a separate narrow model; it does not claim independent real-world validation.
- Stable SHA-256 hashes for canonical UCE evidence, supplied source inventory, graph nodes/edges and observed facts. No original source paths/snippets stored in uploaded evidence artifact. Source snapshot **authentication is not established**; callers must separately pin it to an analyzed commit/snapshot.
- Fail-closed safety budgets: max **5,000 files, 64 package manifests, 4 MiB total readable source, 256 KiB each, 4,000 edges and 1,000 Node decisions**. Parsed diagnostics, ambiguous candidates, unreadable files and truncated results cannot support absence claims. Duplicate paths and path traversal are rejected.

## Semantics and safeguards

The T2 `source-supported` status means **syntax-backed evidence for a relationship**, not a proven compatibility, security, runtime, dependency installation or root cause conclusion. `review-required` is a candidate investigation, not an established defect. `unknown` must not be turned into `compatible` or `resolved`.

Original UCE `AnalysisResult`, numeric scores, issue arrays, weighting, classifications, cache and project source remain **byte-for-byte unchanged** by T2. Findings from the experimental graph are **not automatically promoted** to `UCE/Trilogy/Both` browser labels, canonical issues, Trilogy verified evidence, or reviewable fix patches.

## Reproducible acceptance

```sh
npm ci
node --test testing/trilogy-t0/*.test.mjs
node --test testing/trilogy-t1/*.test.mjs
node --test testing/trilogy-t2/*.test.mjs
node testing/trilogy-t2/run.mjs --output=trilogy-t2-report.json
```

The isolated CI also runs T0/T1 and original frozen accuracy corpus guard. The main UCE CI, CodeQL and security tests remain unchanged.

T2 contracts include positive examples and **negative controls**: comments/strings, dynamic external modules, type-only imports, ambiguous suffixes, package name duplicates, sibling workspace pins, unsupported semver, partial UCE reports, unreadable/invalid paths, parser errors, missing imports, deterministic ordering, budget exhaustion and duplicate metadata.

## Evidence gaps before claims or release

- Independently adjudicated real-world precision, recall, false-positive and false-negative measurement is **not provided by authored contracts** (Issue #80).
- TypeScript AST, import resolution candidates and local manifest names do **not** establish successful build/runtime or identify all dependency relationships.
- Authentic source-commit pinning, closed-world completeness and build-configuration resolution require further work.
- Native Soufflé/Z3/cvc5 resource isolation (Issue #77) and production performance acceptance (Issue #81) remain open.
- T3 may consume these graph facts as **untrusted typed inputs** after separate evidence authentication, with strict process isolation and fail-closed Unknown on tool failures.

**Release posture: review-only, accuracy unknown, developer-safe fixes disabled.**
