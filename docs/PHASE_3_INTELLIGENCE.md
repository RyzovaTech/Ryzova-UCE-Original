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

## Remaining Phase 3 work

- Broader browser feature coverage and richer support states
- API and framework route intelligence across more ecosystems
- Architecture, dependency-risk, and code-quality correlation
- Unified evidence and confidence contracts across intelligence engines

## Increment 2: security intelligence foundation

- Versioned registry expanded from 7 to 20 deterministic rules
- Eight security categories covering secrets, execution, injection, transport,
  access control, information exposure, cryptography, and deserialization
- Language/file applicability prevents unrelated-language matches
- Placeholder credentials and local HTTP development endpoints are suppressed
- Test, fixture, mock, documentation, example, generated, and vendor paths are excluded
- Findings now carry stable rule ids, category, confidence, and non-secret evidence
- Confidence-aware scoring and per-category finding counts
