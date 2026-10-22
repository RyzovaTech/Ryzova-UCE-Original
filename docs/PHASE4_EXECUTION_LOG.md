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
