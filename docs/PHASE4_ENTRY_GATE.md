# Ryzova UCE — Phase 4 Entry Gate

**2026-10-22 | Status: ENTRY MATERIAL PREPARED; not a production release approval.**

## What Phase 3 established
- Local-first opt-in Node-only evidence inspector and serial Soufflé → Z3 → cvc5 stage workers are implemented and validated by [PR #78](https://github.com/RyzovaTech/Ryzova-UCE-Original/pull/78) CI.
- The original UCE analyzer remains authoritative and its score/issues/browser architecture are preserved.
- Review threads in #78 resolved as source-reviewed code patterns, not a universal security certification.

## What experimental Phase 4 entry now adds (PR #79)
- Explicit `--strict-resource-limits` CLI switch; operator-configured delegated Linux cgroup v2 via `UCE_TRILOGY_CGROUP_ROOT`. Never read executable/cgroup paths from repository source. Strict mode fails closed when OS kernel controls are unavailable.
- Kernel-backed `memory.max`, `memory.swap.max=0`, `memory.oom.group=1`, `pids.max=64`, PID membership validation, `cgroup.kill`, kernel `populated 0` cleanup proof and `memory.peak` / `oom_kill` capture for a successful strict run. Queue does not proceed until cleanup is verified.
- macOS and Windows explicitly fail closed for strict limits; ordinary opt-in experimental mode still uses its documented soft sampled Linux RSS guard.
- Tests for unavailable cgroups on all three OS runners. Actual delegated-cgroup tests (including forced descendant OOM) are conditional; **a skip does not validate Linux hard isolation**.
- Initial pinned **unlabeled** real-repository intake and a blind two-reviewer adjudication protocol, tracked by [Issue #80](https://github.com/RyzovaTech/Ryzova-UCE-Original/issues/80). No independent accuracy statistic is claimed.
- Repeated paired benchmark on the same authored fixture: legacy monolithic versus serial verifier whole-process-tree sampled RSS. It reports the limitations of sampled peaks, not a cross-platform memory guarantee.

## Phase 4 execution milestones

| Gate | Pass condition | Status |
| --- | --- | --- |
| 4.1 code & tests | PR #79 final head Full UCE, Trilogy and cross-platform strict CI all green | **Verify final SHA** |
| 4.2 Linux hard caps | Real delegated cgroup-v2 runner; forced OOM proves `memory.events.oom_kill > 0`; no descendants survive and `memory.max` never exceeded | **NOT VERIFIED** |
| 4.3 Windows/macOS strict behavior | Both fail closed without launching solver; documented unsupported status | **Initial CI validated** |
| 4.4 comparative performance | Same workload, pinned runner/versions, 3+ repeated legacy/serial measurements; report tree RSS and cold-start timings | **Pending final-run measurement** |
| 4.5 real-world ground truth | Independently human-reviewed source-backed frozen repository corpus with blind reviewer agreement/adjudication | **NOT COMPLETE — Issue #80** |
| 4.6 production authorization | Owner security review, platform support policy, open-source dependency provenance and release sign-off | **BLOCKED — Issue #77 / #80** |

### Explicit decisions
- **Phase 4 experimental work can begin** from a green PR #79, even while 4.2 and 4.5 remain unresolved, because the purpose of Phase 4 is to close them.
- **No production merge, no browser WASM, and no original UCE scoring change** until 4.2, 4.5 and 4.6 are independently satisfied.
- A compliant local-first release can explicitly leave Windows/macOS strict verification unsupported and fail closed; do not silently fall back to unisolated native execution when strict mode is requested.
- Do not convert future metrics from the synthetic holdout into independent real-project accuracy.

## Commands for an authorized controlled Linux test runner
```bash
# Only on a host where a trusted administrator already delegated
# a writable cgroup-v2 subtree with memory+pids controllers.
export UCE_TRILOGY_TEST_CGROUP_PARENT=/sys/fs/cgroup/your-delegated-uce-parent
node --test experiments/datalog-z3/test/strict-resource.test.mjs

# On a host with the official verified native solvers and locked npm ci deps:
export UCE_TRILOGY_CGROUP_ROOT=/sys/fs/cgroup/your-delegated-uce-parent
node experiments/datalog-z3/optional-cli.mjs \
  experiments/datalog-z3/fixtures/optional-project.json \
  --trilogy --strict-resource-limits

npm --prefix experiments/datalog-z3 run benchmark:memory
```

Only a real execution of the delegated-kernel tests and recorded `memory.peak`/`memory.events` counters can close Linux hard isolation gate. No privilege elevation or automatic cgroup delegation is attempted.

## Executable Phase 4 controlled-validation handoff — 2026-10-22

- The workflow `.github/workflows/trilogy-delegated-cgroup-validation.yml` has a **manual `workflow_dispatch` trigger only** and requires a trusted pre-provisioned `self-hosted, linux, uce-cgroup-v2-ubuntu2404` runner. Configure the trusted repository variable `UCE_TRILOGY_CGROUP_PARENT` with an actually delegated writable cgroup-v2 subtree.
- **GitHub workflow_dispatch caveat:** manual-dispatch workflows must exist on the repository default branch for normal UI/API dispatch. This new workflow is currently ONLY on the **experimental PR #79 branch**, so it is *prepared but not dispatchable through the usual workflow UI until separately reviewed and deliberately installed on default*. No production or browser runtime should be merged for the sake of installing this manual workflow.
- Until a trusted maintainer has provisioned the runner and enabled a reviewed dispatch path, use the controlled-host **local commands** above (after checking out this pinned experimental commit). Keep the full test output and kernel `memory.peak`, `memory.events` counters in privately reviewed artifacts.
- Do **not** enable automatic `pull_request` triggers for an elevated self-hosted runner; that could execute untrusted PR-supplied code.
- The Linux memory benchmark process now starts a dedicated process group, restricts inherited environment, and terminates descendants after each run or timeout. This is separate from mandatory kernel-backed strict-mode validation.
- The final kernel `memory.peak` counter is read only **after** all descendants have exited and `populated=0` has been confirmed, avoiding underreporting from a pre-kill sample.
- The blinded-review vote gate checks supplied metadata and prohibits 0/1-reviewer results, unsupported source hashes and unadjudicated disagreements. It cannot prove reviewers are real people; human identity verification, independence, representativeness and sign-off remain separate.

**Phase 4 experiment entry:** Ready to execute on an appropriately provisioned test runner *when final-head CI is green*. **Issue #77 and #80 remain open and production is NO-GO.**
