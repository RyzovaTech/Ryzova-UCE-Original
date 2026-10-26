# Trilogy T3-B — Real Soufflé + Z3 + cvc5, Kernel-Gated Experiment

**Implementation:** opt-in real native subprocess path on Draft PR #93. **Release: HOLD.** No browser/MCP integration, automated fix, original UCE rule/score change or production activation.

## Supported narrow model

This implementation ports the experimental npm lockfile v2/v3 mandatory-production dependency graph parser plus real Soufflé Datalog reachability, native Z3 and cvc5, restricted to root package.json and package-lock.json with at least two reachable Node engines requirements. Source facts must be caller-pinned with an exact SHA-256 inventory digest. This verifies caller-supplied bytes but **does not authenticate an original Git commit**.

A separately managed local host can opt in by calling `verifyNativeTrilogy(report, sourceFiles, config)`. Native executable paths and their expected SHA-256 hashes, cgroup root and resource budgets must be provided by trusted host policy, never by untrusted repository metadata or an AI-generated fix.

The parent verifies source digest and executable hashes before constructing a delegated Linux cgroup. Worker is blocked waiting on stdin until the parent attaches its PID. Worker then **independently checks its own Linux cgroup** before it parses inputs or imports solvers. The cgroup enforces CPU quota 50000/100000, pids.max 64, memory.max 256–2048 MiB, no swap and group OOM handling. Parent enforces wall time, stdout/stderr bounds and verified post-exit kernel cgroup empty state, memory peak and OOM counter. Missing support, disagreement, timeout, invalid witness/core, stale digest, unexpected subprocess exit and cleanup uncertainty all yield **Unknown**.

The three native engines must independently complete the bounded model: Soufflé reachability, Z3 SAT/UNSAT with witness/core validation, and independent cvc5 SAT/UNSAT verdict. A successful triple result is **modeled-conflict** or **modeled-overlap**, never proven application incompatibility, security vulnerability, root cause, or safe auto-fix.

## CI acceptance

Regular CI runs fail-closed tests including direct native-worker invocation without a cgroup: that must return Unknown and never start a native executable. It is not legitimate to claim native end-to-end verification from these negative tests.

An **additional manual** workflow is supplied at `.github/workflows/trilogy-t3b-native-strict.yml`. Run it only on a dedicated trusted self-hosted Linux runner with label `t3-native` and delegated writable cgroup v2 parent. Configure runner/org vars `TRILOGY_T3B_CGROUP_ROOT`, `TRILOGY_T3B_SOUFFLE`, `TRILOGY_T3B_Z3`, `TRILOGY_T3B_CVC5`. It intentionally fails on missing binary/delegation rather than marking unexecuted native tests as success. Run npm ci at root and within experiments/datalog-z3 before actual native tests.

Conditional native test expects a real, source-backed modeled Node-engine contradiction and all three engines succeeded, with kernel-enforced cleanup and zero OOM kills. A workflow not run on a delegated host means **native end-to-end verification remains pending**.

## Remaining release blockers

This kernel cgroup gate does **not** implement a filesystem quota, network namespace, read-only mount policy or Windows Job Objects. Independent signed-commit source provenance, native process tree security audit, representative perf budgets (#81), blinded real repository accuracy labels (#80), and accepted native hard isolation (#77) remain needed before deployment. Source/path hashes are not anonymous to a dictionary attack. Default UCE engine, score and report remain unchanged. Do not merge to main before explicit owner review.

**Hardened native child boundary:** All Soufflé/Z3/cvc5 calls now use one `experiments/solver-safe-spawn.mjs` entrypoint that independently verifies the current kernel cgroup and restricts role-specific argument shapes, shell, process groups, and environment. No security warnings are ignored or suppressed.
