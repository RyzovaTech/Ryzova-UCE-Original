# Ryzova UCE — Phase 4 technical handoff / Phase 5 entry

**Date:** 2026-10-22. **Track:** opt-in local Node Smart Verification, stacked experimental branches only.  
**Production:** NO-GO. No main-branch merge, deployment, browser import, score change, or default-enablement authorized.

## Engineering progress (Phase 4)

- Soufflé → Z3 → cvc5 verification stages run sequentially, with each stage worker closed before the next starts and source-backed evidence or Unknown fallback.
- Independent 86-case bounded `node-semver` oracle tests confirm Z3 and cvc5 results for authored numeric ranges; this is not human-reviewed real-world accuracy.
- Native-Z3 benchmark-only alternative in Phase 4 showed lower *sampled* peak RAM than legacy in a 10-run synthetic fixture. This is not an OS-enforced process-tree peak guarantee or a real project benchmark. Default WASM solver remains unchanged.
- New exact-source nested npm lock resolver: for each required dependency, check the nearest installed nested `node_modules` candidate and climb ancestors only if absent; refuse version mismatch rather than incorrectly falling back to the hoisted candidate. Scoped package names and duplicate installed copies retain independent source identities.
- Expanded bounded metadata: max **1MiB each source file**, **2,048 lock entries**, **512 reachable mandatory installed packages**, **2,048 edges**, **32 constraints**, depth **32**. These are finite safety budgets, not a project-size eligibility trigger; only complete mandatory production source-backed relationships qualify. Unreachable dev-only entries are not interpreted as runtime obligations.
- Optional peer *metadata hints* with no actual peer requirement are not installed obligations. Actual peer, root workspace, optional activation, platform-specific, alias, and link resolution semantics remain **unsupported / Unknown**. Supported SAT means only joint stable Node `engines.node` satisfiability within the declared mandatory dependency scope, never whole-app compatibility.
- Pinned exact open-source axios/axios commit `e6b79d9cef796ca3a903bb83e51d4752b019fd67` is bundled as **offline real-source coverage fixture**. Original Git blob SHAs are asserted:
  - package.json `b4e3d1e48866809f4098494516806afdf1a8bcb5`
  - package-lock.json `0fc1d3dcf01f09e50bf34a538e16de1743151516`
  - It has a lock of ~344,460 JavaScript characters and 687 lock entries, including dev-only and nested installs; mandatory source graph preflight gives 26 reachable installed packages, 23 `engines.node` requirements. A successful CI run of the new tests is required before claiming this real fixture as verified coverage.
- Original UCE analyzer and reports remain authoritative; the additional verification diagnostic cannot rewrite its compatibility scores/issues.

## Owner's requested sequencing

**1. Coverage first:** expand verified semantics without ignoring nested resolution, missing requirements or workspace boundaries. Source-supported real fixture and regression gates first; general ecosystem-wide coverage percentage cannot be inferred from seven convenience-selected projects.

**2. Accuracy after product:** independent human reviewers and blinded adjudication are deferred by the owner until after product work. Keep [Issue #80](https://github.com/RyzovaTech/Ryzova-UCE-Original/issues/80) **open**; NEVER claim independent real-world accuracy from authored synthetic tests, a SAT result, or GitHub blob provenance.

**3. Safety:** Linux strict cgroup v2 hard limits fail closed when delegation is unavailable, and macOS/Windows strict mode explicitly abstains. [Issue #77](https://github.com/RyzovaTech/Ryzova-UCE-Original/issues/77) remains **open** until a controlled delegated Linux runner proves real forced OOM, `memory.peak`, `memory.events`, and no surviving descendants. Default local Node soft sampling is not the hard limit.

**4. Release is owner-managed:** retain all experimental PRs as Draft, disabled by default and unmerged. Owner may separately choose supported platform policy and sign-off after security, license, performance and accuracy review; this handoff gives no deployment approval. [Issue #81](https://github.com/RyzovaTech/Ryzova-UCE-Original/issues/81) remains the performance acceptance record.

## Phase 5 engineering entry (NOT production release)

Phase 5 experiments may start on a **green final-head Phase 4 PR**, without silently marking externally controlled release gates as passed. Suggested technical goals:
- Broaden scoped npm workspace, optional/platform and peer-resolution support one semantics family at a time with source-backed soundness/oracle tests; default Unknown for unsupported ecosystems.
- Improve provenance and proof subset reporting; avoid global SAT or install/runtime guarantees.
- Benchmark real supported repository inputs with pinned toolchains and **kernel-backed** process-tree peak memory on an owner-provisioned test machine.
- Keep original UCE report parity and browser isolation; do not enable remote solver APIs or original scoring modifications.
- Prepare anonymized blinded-review worksheet and immutable source corpus for the owner's post-product accuracy assessment.

### Phase 5 handoff acceptance checklist

- [ ] Final-head Full UCE, Trilogy and cross-platform strict fail-closed CI successful
- [ ] Real frozen axios fixture has passed source SHA and verified scoped solver tests
- [ ] Nested shadowing, scoped resolution, unsupported semantics and budget regression tests pass
- [ ] No unresolved untriaged security code-review findings
- [ ] External gates #77, #80, #81 remain clearly documented rather than falsely closed
- [ ] Experimental branch remains draft/unmerged; production website unaffected

**This separates experimental engineering readiness from production release certification.**
