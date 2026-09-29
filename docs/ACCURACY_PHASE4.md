# Accuracy Phase 4: conservative correlation evidence

The V3 correlation pass now requires stronger evidence before reporting some
relationships. The bounded value-path matcher still identifies a source
assignment followed by a named-variable sink in the same file, but excludes
commented or quoted examples, reassignment between source and sink, and
unrelated functions or Python dedented blocks. It reports a **warning** with
**review-required** confidence and both line locations. These checks do not
prove control flow, sanitization, reachability or exploitability. They are not
a replacement for a language-aware taint analysis.

Import boundary checks ignore comments and TypeScript `import type` / `export
type` statements, while retaining runtime imports. Seven context-link rules
that merely joined unrelated positive patterns (such as a click handler and
keyboard focus support, or a server route and a client fetch) have been
removed. The remaining context rule pairs a module package manifest with a
CommonJS TypeScript configuration in the same workspace and still requires
review. The rule allocator fills the seven retired IDs with seven different
value-path rules: total active V3 rules remain 10,000 and Phase 4 has 2,500.

## Limits and validation

These lexical checks are conservative. A sink inside a nested block may be
missed, and indirect aliases, cross-file flows, dynamically constructed calls,
and complex language syntax are not traced. The ZIP sweep from Phase 3 only
executes standalone source and dependency rules on later files; cross-file
and value-path correlations still run on the bounded core sample. Coverage
must remain partial when the core sample is limited. No world-wide accuracy
percentage follows from these fixtures.

Regression fixtures cover direct paths, comments, strings, reassignment,
separate JavaScript functions, Python dedents, type-only imports, and runtime
imports. Run `npm test`, `npm run check`, `npm run validate:schema`, and
`npm run audit:accuracy:baseline` before release.
