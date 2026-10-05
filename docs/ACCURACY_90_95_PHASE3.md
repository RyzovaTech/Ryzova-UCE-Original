# Phase 3: security false-positive reduction

Phase 3 reduces security review signals manufactured by comments and literal examples while preserving executable calls, embedded JavaScript template expressions, secret literals and endpoint literals. This is lexical context analysis, not proof of exploitability.

## Delivered

- Acorn token context for JavaScript-family files excludes comments, ordinary strings, regex literals and template text. Template expressions remain executable. Tokenization failures preserve findings in the unverified suffix.
- Python uses the existing offset-preserving prose/code masks, so a comment marker inside a string does not hide later executable calls.
- C, C++, Java, Go, Rust and PHP receive comment/string context, including C++ and Rust raw literals and Go backticks. Quoted configuration keys remain active when a rule extends into the value.
- Secret/endpoint rules SEC005, SEC008, SEC009 and SEC039 continue inspecting literal content; comments are excluded.
- A generic legacy-hash finding (SEC020) is removed only when every matching range is covered by a specific password-hash finding (SEC028) on the same file and line. Independent checksum matches stay reviewable.
- Existing production/configuration scope exclusions remain in force. Analysis cache version is 16; security knowledge version is 4.3.0.
- CI enforces the new corpus and seven context regression groups alongside existing checks.

## Measured development contracts

The committed 140-decision synthetic corpus covers eight ecosystems, twelve security rule families, executable calls, literal examples, comments and scope exclusions. Labels describe whether a review signal is expected, not whether a vulnerability is proven. Excerpts are detector contracts and need not be complete compilable programs.

| Measurement | Phase 2 parent | Phase 3 |
| --- | ---: | ---: |
| Correct decisions | 84/140 | 140/140 |
| True positives | 28 | 46 |
| False positives | 38 | 0 |
| False negatives | 18 | 0 |
| True negatives | 56 | 94 |
| Decision accuracy | 60% | 100% |
| Precision | 42.42% | 100% |
| Recall | 60.87% | 100% |

The parent measurement uses commit `7290be204771bfc801d3d6639fe1394e500970ce`. Full before/after decisions are committed under `testing/security/`. Run `npm run audit:accuracy:security` and `npm run test:security-context` to reproduce the new gate.

All labels are agent-provisional; zero have independent human adjudication. The corpus was used during implementation, so it is a development regression set, not an independent holdout. Its precision/recall Wilson 95% interval is 92.29–100%, but that interval describes this selected sample only. **Global 90–95% accuracy is not established.** Independent real-project adjudication remains necessary.

## Verification and limits

Local validation passed build, typecheck, lint, 904 knowledge checks, 12 Phase 2 evidence groups, seven security context groups, and the existing bounded/development/pinned/scope audits. The V3 rule fixture suite covers 30,000 assertions and remains a separate compatibility check.

Security patterns still require human review. This change does not establish binding identity, reachability, taint flow or sanitizer trust; it does not suppress a finding merely because a function is named “sanitize”. The C-like adapter is intentionally limited: language-specific interpolation and nested-comment syntax are not comprehensive parsers. Other supported file formats retain the prior conservative comment filter. JavaScript/TypeScript token context is not a full TypeScript/JSX semantic parser. Genuine risky calls, secrets and endpoint configurations remain review signals.
