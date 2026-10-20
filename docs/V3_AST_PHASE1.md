# UCE V3: Real AST detector pilot (Phase 1)

**Scope:** V3 `kind: 'ast'` detectors over JavaScript (`.js`, `.mjs`, `.cjs`), JSX (`.jsx`), TypeScript (`.ts`, `.mts`, `.cts`) and TSX (`.tsx`). This is a **syntax-only** upgrade, not a symbolic solver or a data-flow engine.

## What changed

The old V3 `astEvidence()` used regular expressions despite the `ast` label. The bounded Acorn TypeScript parser now produces actual syntax nodes for the five existing query families:

- `call`: actual call expressions with exact identifier/property chains (e.g. `document.write(...)`).
- `import`: static imports/re-exports, literal dynamic imports and literal `require(...)`.
- `assignment`: simple `=` writes to the named identifier or property. Object declarations, comparisons and compound assignments are **not** included.
- `jsx-attribute`: actual JSX/TSX attributes.
- `declaration`: named variables, functions, classes, interfaces, type aliases and enums.

Comments, strings, object keys and malformed source are no longer accepted as AST evidence. Reports include source file, 1-based line and the actual query match.

## Guardrails and limits

- Scanned project code is **never executed**. No dependency imports, remote parsing services or semantic type-checking are performed.
- Files over **256 KiB of characters** and parses visiting over **50,000 syntax nodes** return no AST evidence and mark the applicable rule as truncated. Existing per-rule file, time and byte budgets remain in effect.
- Syntax errors return no AST match. Unsupported languages also produce no AST match rather than silently falling back to regex.
- AST chains are **syntactic**. The engine does not track aliases, trust boundaries, taint or actual runtime behavior; other V3 regex detectors remain independent and may still produce review-only observations.
- UCE uses existing `acorn` with the pinned `acorn-typescript` plugin for JS/TS/JSX/TSX, keeping the heavyweight TypeScript compiler out of the browser worker. Verify worker bundle size, startup and memory before wider AST adoption.

## Validation

Every PR runs `npm run test:v3-ast`, the existing 10,000-rule fixtures, and accuracy/budget CI gates. The new tests cover syntax positives/negatives, comments, strings, malformed TS, JSX, exact line evidence, file size limits, and the existing `code.web.inner-html-assignment` V3 rule.

**Accuracy claim boundary:** These are agent-authored regression tests, **not** independent human-adjudicated precision/recall. The pinned 1,000-project language-label benchmark tests a separate metric and should not be reported as validation of AST/security accuracy.

Follow-on work: measure bundle/worker memory and real-project AST findings against independently reviewed source sites; decide whether a smaller/lazy parser adapter is needed before adding new languages or symbolic constraints.
