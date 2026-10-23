# Phase 4 — Active Experimental Evaluation Log

**Date:** 2026-10-22. **Status:** Evaluation STARTED. Not production approved and not an independently adjudicated compatibility study.  
**Base:** Phase 4 safety-preparation PR #79; current work performed on a separate nonproduction evaluation branch.  
**Preserved invariant:** Original UCE `analyzeProject()`, report scores/issues and browser UI are unchanged. No branch merged/deployed.

## 1. Controlled synthetic-fixture memory study

Two earlier Linux CI 3-run pairs observed **higher peak memory** for isolated stages; no memory reduction has been proven.

### Verified 3-arm initial experiment

[GitHub Actions experiment run #39739033150](https://github.com/RyzovaTech/Ryzova-UCE-Original/actions/runs/39739033150) ran on Linux x64 with Node 20.20.2, fixed authored `fixtures/conflict.json`, and 20ms `/proc` child-tree RSS sampling:

| Mode | Individual sampled peak RSS (MiB) | Mean (MiB) | Illustrative latency (ms) |
| --- | --- | ---: | --- |
| Monolithic legacy | 146.80, 150.38, 148.72 | **148.63** | 552, 549, 550 |
| Default sequential stages | 201.01, 197.19, 203.74 | **200.65** | 732, 727, 717 |
| Sequential with Z3 128MiB V8 heap (experimental) | 194.66, 189.51, 192.75 | **192.31** | 752, 761, 761 |

The heap experiment reduces sampled memory by approximately **4.2% vs default sequential**, but still measures approximately **29.4% more memory than legacy** in this tiny experiment. These are not kernel `memory.peak` values. They do not show production behavior or a statistically stable memory advantage. **Keep #81 open.** The optimization flag is **not** enabled by default.

### Phase 4 experiment now underway

- Increase comparative repetitions from three to **ten** per mode on the identical fixture. Allow only a small validated repetition count (3–20).
- Record the distribution: mean, median, approximate p95, median wall time, and per-stage *direct worker* sampled RSS (Soufflé/Z3/cvc5) with stage start/close chronology.
- Require the same source-backed cross-verified conflict on every successful measurement. Report a failed experimental arm explicitly instead of dropping it or counting it as a memory win.
- Maintain strict interpretation: `/proc` 20ms sampled sum may miss short peaks and double-count shared RSS; `memory.peak` from an enforced cgroup must be collected on an independently provisioned delegated Linux runner.

## 2. Real-repository capability preflight — 7 pinned projects, no solver or human labels

Verified immutable GitHub manifest and lockfile blob hashes, exact source contents/character lengths and root lockfile package counts. Results are in `testing/trilogy/real-repository-preflight-v1.json`.

| Case | Pinned source | Supported-graph preflight finding |
| --- | --- | --- |
| RR01 | Ryzova UCE Original | v3 lock present, 386 lock package entries and 28 nested installations; current limit is 97 entries and hoisted-only graph |
| RR02 | Express | No root `package-lock.json` at pinned commit |
| RR03 | Fastify | No root `package-lock.json` at pinned commit |
| RR04 | Slugify | No root `package-lock.json` at pinned commit |
| RR05 | Axios | v3 root lock contains 344460 JS characters, above 262144 source-character limit |
| RR06 | npm CLI | v3 root lock contains 437638 characters, above limit; root also has workspace scope |
| RR07 | uuid | v3 root lock contains 480551 characters, above limit |

**All seven fail the current model's complete supported-graph preflight** on at least one documented condition. This is a **convenience candidate set, not random or representative sampling**. It measures neither real-world accuracy nor the population-wide coverage percentage. It is explicitly incorrect to count an unsupported graph as an UNSAT, SAT or false positive/negative.

### Follow-up sampling requirement

Before estimating covered real-world opportunity groups, freeze a larger prospectively selected set that **includes supported small complete npm lock graphs** and independent excluded/unsupported examples. Record selection mechanisms and individual scope. Do not broaden graph semantics simply to fit this corpus without independent soundness tests.

**Issue #80 remains open**: two genuine independently blinded human reviewers, source-backed labels and third-party disagreement adjudication must precede any accuracy/precision/recall computation.

## 3. Hard memory and platform safety gate

- Phase 4 strict Linux cgroup v2 implementation and fail-closed Windows/macOS tests exist in draft PR #79.
- Normal hosted GitHub Actions cross-platform fail-closed tests are **NOT** proof of enforced `memory.max` or a forced OOM.
- A trusted externally provisioned Linux runner with delegated memory+pids cgroup controllers and observed kernel `memory.events`/`memory.peak` is needed to complete Issue #77.
- No credentials or project runtime code should be sent to third-party services; testing is offline/local-first for native engines.

## 4. Acceptance and release status

| Gate | Current status |
| --- | --- |
| Phase 4 evaluation script and source preflight | Implemented on experimental branch; final-head CI pending |
| 10-run benchmark, actual output | Pending new CI |
| Independently adjudicated real-repo accuracy | **NO** — #80 |
| Performance memory reduction | **NOT PROVEN** — #81 |
| Controlled delegated Linux cgroup/forced-OOM proof | **NOT VERIFIED** — #77 |
| Windows/macOS strict mode | Fail-closed only; no native hard isolation claim |
| Production merge/sign-off | **NO-GO** |

**Decision:** Phase 4 has started as a controlled experimental evaluation. Neither source-bounded empirical coverage, human accuracy, lower memory peaks, nor production safety may be inferred from the existence of this document or CI tests alone.

## 2026-10-22 — Native-Z3 optimization experiment (NOT default-enabled)

- A bounded native `z3 -in -smt2` stage has been added in `experiments/datalog-z3/native-z3.mjs` behind an **explicit experimental option**, with fixed argv, `shell:false`, bounded stdin/stdout/time, restricted child environment and a source-validated semver witness.
- This test path uses the same validated SMT-LIB facts as cvc5; the **Z3 solver** and **cvc5 solver** remain distinct executables, but the shared encoding must NOT be mislabeled as independent model construction.
- For UNSAT, the return includes the complete original source-constraint set as a source-backed UNSAT **subset**, not a claimed minimal unsat core. The existing optional smart report independently verifies source mapping and cvc5 result.
- The benchmark now includes a **fourth arm**: legacy monolithic, serial WASM Z3, serial WASM Z3 with experimental 128MiB V8 heap, and serial **native Z3 CLI**. Baseline behavior and optional UCE scoring remain unchanged.
- CI installs the Ubuntu native `z3` package for this experiment and exercises native-z3 witness plus cvc5 independent status cross-check and exact stage ordering. **Neither the CI result nor new 4-arm memory values have been verified at this checkpoint.**
- Native-Z3 is a potential response to the repeated ~34% extra peak memory with the serial WASM path. Do NOT promote the alternative or assert memory savings before matching-source benchmark and evidence validation.

### Full UCE audit blocker

On the preceding PR #82 head, Full UCE CI failed on an HTTP 400 npm security-audit backend response (`Invalid package tree`) and then a secondary missing SARIF upload. The experimental CI workflow now requests a `--package-lock-only` production-dependency audit with bounded registry retries; it **still fails closed** on a registry error or vulnerability finding. The SARIF upload requires an existing generated report, avoiding a misleading secondary failure. The true success/failure of the updated audit requires a fresh CI run; do not claim green before checking it.

### Independent release gates remain open

- [#77](https://github.com/RyzovaTech/Ryzova-UCE-Original/issues/77) — delegated kernel cgroup forced-OOM/no-survivor proof and authorized platform sign-off
- [#80](https://github.com/RyzovaTech/Ryzova-UCE-Original/issues/80) — two genuinely independent blinded reviewers, adjudicated real-case labels and scoped real-world accuracy
- [#81](https://github.com/RyzovaTech/Ryzova-UCE-Original/issues/81) — accepted hard process-tree memory and latency evidence, not just direct-child RSS

**No production, main-branch, or browser merge has occurred.**

## Phase 4 continuation — independent bounded semver oracle checks

The Native Z3 and cvc5 agreement from PR #82 is valuable but insufficient on its own to detect a **shared SMT-LIB encoding error**, since both CLI engines consume equivalent generated constraints.

Phase 4 evaluation PR #83 therefore adds **86 deterministic semantic fixtures**: 11 explicit semver boundary/disjunction examples and 75 seeded generator examples. Each input is checked using the independent `node-semver.satisfies` library over a bounded **6 major × 5 minor × 5 patch = 150 stable-version lattice**, and both solvers must independently return the corresponding SAT/UNSAT decision. The generator restricts all operands to major ≤3, minor ≤2, patch ≤2; this makes the finite lattice complete for the fixture syntax. Every SAT witness is rechecked with `semver.satisfies`; UNSAT is checked against the full source constraint set rather than mislabeled as a minimal core.

**Resource invariant:** Z3 and cvc5 test invocations are strictly sequential. The optional smart verifier's experimental native command is now restricted to the fixed `z3` executable name; arbitrary binary paths are rejected before any stage starts. Default original UCE score, browser behavior, and solver path remain unchanged.

**Evidence limitation:** 86 deterministic unit cases are not a representative real-repository study, do not establish independent human labels, and do not clear Issue #80. The optional native-Z3 backend remains experimental until tool provenance, hard process-tree resource bounds (#77), performance (#81) and maintainer sign-off are complete.

**Validation:** final-head GitHub Actions must be inspected before marking this new suite green.
