# Phase 3.5 — Full Intelligence Coverage

Phase 3.5 closes the intelligence gaps identified after Phase 3. It adds a
shared evidence, finding, confidence, score, and recommendation contract across
fourteen dedicated modules while preserving all older report fields.

## Dedicated modules

1. Project Intelligence — purpose metadata, project type, architecture, and size
2. Runtime Intelligence — detected runtimes and version declaration readiness
3. OS/Platform Intelligence — Windows, Linux, macOS/iOS, Android, paths, commands
4. Build Intelligence — build tools, scripts, and overlapping configurations
5. Testing Intelligence — frameworks, test structure, ratios, coverage readiness
6. Performance Intelligence — large assets, blocking APIs, render-blocking scripts
7. Accessibility Intelligence — deterministic HTML/JSX interaction and markup checks
8. API Intelligence — REST routes plus GraphQL, WebSocket, and gRPC markers
9. Database Intelligence — engines, ORMs, schema models, and migration files
10. Environment Intelligence — source usage compared with safe example declarations
11. License Intelligence — license files, SPDX-style metadata, restricted metadata
12. Documentation Intelligence — README setup, usage, configuration, license, API docs
13. Maintainability Intelligence — size, cycles, branching, duplication, debt markers
14. Git/Repository Intelligence — ignore rules, CI, contribution and policy health

## Overall compatibility view

The fourteen module scores are combined with the Phase 3 browser, security,
dependency, architecture, code, and technology engines. The report renders a
compact coverage grid and only the highest-priority findings initially, keeping
the complex analysis understandable.

## Safety and interpretation

- Analysis is deterministic and runs client-side without executing project code.
- Secrets are compared by variable name only; values are never copied into findings.
- Test, fixture, generated, vendor, and documentation scopes are excluded where
  production evidence is required.
- Static findings indicate review opportunities, not guaranteed runtime defects.
- License checks inspect repository metadata only; they do not replace legal review
  or an external dependency-license database.
- Accessibility checks identify deterministic source patterns; they do not replace
  keyboard, screen-reader, contrast, or user testing.

## Completion gate

Phase 3.5 requires deterministic regression tests, TypeScript typecheck, ESLint,
production build, dependency audit, and exact Git tree verification before push.

Current verification baseline: **659 deterministic checks**.
