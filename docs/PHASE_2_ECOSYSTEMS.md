# Phase 2 increment 2 — ecosystem-qualified dependency evidence

Knowledge version 2.1.0 adds 85 technology definitions across Python, Cargo,
Go and Composer, bringing the registry to 339 definitions. Definitions can
describe the same technology in different ecosystems; this is not a count
of unique frameworks.

Supported declaration forms:

- Python: named requirements in requirements.txt / requirements-dev.txt and
  similarly named files, extras and normalized package names.
- Cargo: single-line dependency entries in dependencies, dev-dependencies and
  build-dependencies tables; inline package aliases.
- Go: single require directives and require blocks.
- Composer: JSON require and require-dev objects.

Readers do not run package managers, follow URLs/includes, or execute repository
code. Evidence remains scoped to production/configuration files. Names are
qualified by ecosystem to avoid cross-registry collisions.

Limitations: no full TOML parser, pyproject dependency extraction, multiline
Cargo tables, workspace/target-specific Cargo inheritance, recursive requirements
includes, Go replace resolution or lockfile resolution in this increment.
Existing legacy manifest-pattern detectors remain separate and may still produce
broader results; new exact dependency tests do not validate those older rules.
Primary framework selection and the multi-page UI are unchanged.

Tests cover every new definition with positive, wrong-ecosystem, fixture-scope
and near-name-negative inputs, plus parser regressions. These are synthetic
fixtures, not the planned 50 real-world repository benchmarks.

Format references:
- https://pip.pypa.io/en/stable/reference/requirements-file-format/
- https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html
- https://go.dev/ref/mod
- https://getcomposer.org/doc/04-schema.md
