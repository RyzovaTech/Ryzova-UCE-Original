# UCE V3 Phase 2 — First 3,000 Core Rules

Phase 2 expands the V3 rule platform from five detector-adapter bootstrap rules to
an exact inventory of 3,000 built-in rules. The rules are compiled from compact,
versioned knowledge definitions so UCE does not carry a hand-copied 3,000-object
blob or require analyzer-core changes when the catalog grows.

## Delivered inventory

| Area | Phase 2 rules |
| --- | ---: |
| JavaScript / TypeScript / web | 800 |
| JVM / Java / Kotlin | 447 |
| Native C / C++ | 467 |
| Python | 388 |
| .NET / C# | 270 |
| Rust | 170 |
| Go | 120 |
| PHP | 118 |
| Other ecosystems | 109 |
| Cloud / DevOps | 65 |
| API / data | 25 |
| Framework escape hatches | 12 |
| Accessibility fundamentals | 4 |
| **Phase 2 total** | **2,995** |
| Bootstrap detector rules | 5 |
| **V3 core total** | **3,000** |

The allocation is generated from the pack data and is also available in the
[complete generated rule index](generated/V3_PHASE2_RULES.md).

## What the rules cover

- Deterministic technology evidence for the UCE technology registry.
- Dependency version hygiene for npm, Python, Cargo, Go Modules, Maven, Gradle,
  Composer, NuGet, Conan, and vcpkg manifests.
- Security-sensitive code boundaries across JavaScript/TypeScript, Python,
  Java/Kotlin, C/C++, C#/.NET, Go, Rust, and PHP.
- React, Next.js, Vue, Angular, and Svelte security escape hatches.
- Browser and Web API permission, privacy, origin, storage, and fallback review.
- Docker, GitHub Actions, and common cloud-configuration risks.
- SQL, REST-style client, GraphQL, WebSocket, and database transaction boundaries.
- Initial HTML/JSX accessibility fundamentals.

## Validation gates

- Exactly 3,000 total built-in rules and 3,000 globally unique IDs.
- Every pack passes schema-v3 runtime validation.
- No duplicate detector signatures, missing dependencies, dependency cycles, or
  enabled conflicts across the combined rule graph.
- Positive, negative, and production/test-scope fixtures.
- Manifest execution fixtures for npm, Python, Maven, NuGet, and vcpkg.
- TypeScript typecheck, lint, application build, and the existing 100+ fixture
  regression corpus.
- Per-rule file, content, match, and execution-time budgets.

## Trust boundary

The 3,000 count is a rule inventory, not a claim of 3,000 vulnerabilities or
3,000 CVEs. Static API and configuration matches default to `review-required`
when data flow or runtime intent cannot be proven. Test, fixture, generated, and
vendor scope filtering remains active, and each finding carries evidence,
confidence, recommendation, and false-positive guidance.
