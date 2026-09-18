# Phase 2 — Knowledge and Detection Expansion

Phase 2 is complete at registry version `2.2.0`. This phase expands UCE's static,
non-executing project understanding while keeping every finding tied to visible
repository evidence.

## Delivered coverage

| Area | Coverage |
| --- | ---: |
| Language labels | 77 |
| Technology registry definitions | 639 |
| Package managers | 40 |
| Build tools | 60 |
| Runtimes | 25 |
| Databases and data services | 50 |
| Testing tools | 60 |
| Cloud and deployment platforms | 40 |
| CI/CD systems | 25 |
| Soft project capabilities | 25 |

The analyzer now builds evidence-backed relationships such as `builds-with`,
`tests-with`, `stores-in`, `deploys-to`, `automated-by`, and `packages-with`.
Capability and relationship fields are optional in the report contract so older
stored reports remain readable.

## Ecosystem-aware dependency evidence

In addition to npm-compatible manifests, UCE has bounded readers for:

- Python requirements files, PEP 621-style dependency arrays, and Poetry tables
- Cargo dependency, workspace dependency, target dependency, and alias forms
- Go `require` declarations and blocks
- Composer `require` and `require-dev` objects

These readers never install packages, follow remote includes, or execute project
code. Test, fixture, generated, vendor, and documentation scopes are excluded
from technology evidence.

## Accuracy safeguards

- Repeated workspace markers do not inflate confidence.
- Confidence combines independent evidence kinds instead of raw occurrence count.
- Generic shared drivers do not imply a specific compatible database product.
- Generic cloud filenames require vendor-specific content evidence.
- Next.js alone does not imply Turbopack; the command flag must be present.
- Invalid or malformed manifests fail safely without stopping analysis.

## Verification baseline

- 638 deterministic knowledge checks
- TypeScript typecheck and ESLint pass
- Production build pass
- Production dependency audit: zero known vulnerabilities

## Intentional boundaries

This is static evidence detection, not semantic compilation or package
resolution. A registry entry means UCE knows a technology and its safe markers;
it does not guarantee every possible manifest syntax or version interaction is
covered. The legacy primary-stack summary remains intentionally narrower than
the full technology inventory. Multi-page progressive report UX and broad
real-world repository benchmarking belong to later phases.
