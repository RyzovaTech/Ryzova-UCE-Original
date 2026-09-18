# Phase 3 — Intelligence Engines

Phase 3 turns the expanded Phase 2 knowledge into deeper, explainable analysis.
It starts with Browser Compatibility Intelligence 2.0 because browser findings
must be based on the project's own targets rather than a hidden global guess.

## Increment 1: browser compatibility foundation

- Versioned registry of 25 JavaScript, CSS, and Web API features
- Exact target extraction from `.browserslistrc` and `package.json`
- Target provenance and an explicit default-baseline indicator in reports
- Support for permanently unavailable browser/feature combinations
- Evidence contains feature id, file, line, affected browsers, and remediation
- Test, fixture, example, generated, vendor, and build outputs are excluded
- Deterministic regression coverage for configuration precedence and findings

Browserslist supports expressive queries that require its full resolver and
up-to-date usage data. This first increment intentionally resolves only explicit
browser/version constraints. When a project supplies only relative queries such
as `last 2 versions`, UCE labels and uses its documented default baseline rather
than pretending that it resolved those queries offline.

## Increment 2: security intelligence foundation

- Versioned registry expanded from 7 to 20 deterministic rules
- Eight security categories covering secrets, execution, injection, transport,
  access control, information exposure, cryptography, and deserialization
- Language/file applicability prevents unrelated-language matches
- Placeholder credentials and local HTTP development endpoints are suppressed
- Test, fixture, mock, documentation, example, generated, and vendor paths are excluded
- Findings now carry stable rule ids, category, confidence, and non-secret evidence
- Confidence-aware scoring and per-category finding counts

## Increment 3: correlated intelligence and completion

- Browser findings distinguish partial support from unsupported targets
- API routes are detected across Next.js, Express/Fastify/Hono, FastAPI/Flask,
  Spring, Laravel, Gin/Fiber/Echo, ASP.NET, Django, Go net/http, Rails, and Phoenix
- File-system API routes are normalized, including dynamic Next.js segments
- Workspace package manifests are analyzed together for version conflicts
- Wildcard and remote-source dependency declarations become explicit risks
- Large-function detection measures the function body instead of file length
- Security, browser, dependency, architecture, quality, and testing signals are
  correlated into a prioritized, confidence-bearing insight layer
- The report presents correlated insights without exposing secret values

## Phase 3 completion baseline

- 100+ versioned browser feature rules with desktop/mobile target provenance
- 40 context-aware security rules across thirteen categories
- 12 API/framework route families plus file-based Next.js routing
- Workspace-aware dependency risks and confidence-aware correlation
- 654 deterministic regression checks
- Typecheck, lint, production build, and production dependency audit gates

Phase 3 is complete. The engines remain conservative static analysis: findings
are review signals, not proof of runtime behavior or exploitable vulnerabilities.
The next phase may reorganize the report into progressive pages without changing
these backward-compatible optional report fields.
