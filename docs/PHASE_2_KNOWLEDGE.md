# Phase 2: first knowledge expansion

This release adds 49 language/markup/configuration labels to the existing 28,
and 189 direct-dependency technology definitions. The combined technology
registry has 254 entries; these are not all frameworks.

## Scope

- Language inventory: 77 labels, including programming, markup and data formats.
- Expanded categories: libraries, testing, databases, ORMs, build tools,
  authentication, styling and linting.
- Knowledge version: 2.0.0.
- Source/configuration evidence only; test, fixture, generated, vendor and
  documentation dependency declarations do not contribute.
- Dependency presence means declared, not necessarily executed in production.
- Repeated evidence of the same kind cannot inflate confidence.
- JSON/config file volume does not override executable source language.
- Existing report fields and optional Phase 1 evidence fields are retained.

Run `npm test` for synthetic positive/negative dependency fixtures, language
classification/detection fixtures, mixed-workspace and false-positive regressions.
Tests run locally without fetching or executing uploaded repositories.

## Not yet complete

This is the first Phase 2 increment, not all roadmap targets. The new dependency
pack currently reads npm-style manifests. Python/JVM/Rust/etc retain the earlier
manifest signatures. Forty package managers, forty cloud providers, architecture
expansion, fifty real-world repository benchmarks, and the technology relationship
graph remain future work. New evidence is exported in JSON; multi-page report UX
is still a later phase. Static recognition is not semantic analysis of 77 languages.
