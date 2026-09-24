# UCE V3 Phase 4 — Evidence-linked intelligence

Phase 4 adds 2,500 executable correlation rules to the previous 6,500 V3 rules. The inventory now has 9,000 unique IDs in 32 built-in packs. The [generated rule index](generated/V3_PHASE4_RULES.md) lists exact allocations and IDs.

| Evidence mode | What must be present |
| --- | --- |
| Browser target | A matched web-platform feature and an explicit target below the recorded support baseline; default targets alone do not produce these findings. |
| Manifest and lockfile | A pinned npm dependency in a package manifest and a different installed version in the same directory's package-lock.json. Only direct, exact version strings are compared. |
| Value path | A named variable assigned from a selected external-input expression and passed to a selected sensitive operation later in the same file, within 35 lines and without a detected intervening reassignment. |
| Import boundary | A real relative import in a client path that resolves to an existing server/internal source file. |
| Context links | Two selected configuration or code signatures in the same file or workspace. These are co-occurrence review prompts, not established conflicts. |

The value-path detector **does not perform a complete AST, control-flow, alias or interprocedural analysis**. A matching source and sink can still be unreachable or sanitized. All Phase 4 security findings carry review-required confidence and warning severity. The V3 validator refuses critical security rules while these bounded detectors cannot prove semantic data flow.

The existing browser compatibility engine already calculates a separate compatibility report. Phase 4 adds rule-level evidence tied to explicitly configured browser targets; it can describe the same feature in V3 findings. It does not infer browserslist queries beyond the engine's explicit version parser.

The schema and SDK expose the new correlation detector with bounded budgets and source/related-file evidence. Add a new pack through the default registry without editing analyzer core. Validate with npm test, npm run check, npm run build, npm run benchmark, npm run security:self-scan, and regenerate the index via npm run docs:rules. The exact count verifies executable schema, unique signatures, graph consistency and fixtures; it is not a measured real-world detection-accuracy percentage.
