# Trilogy T6 — Developer-Safe Fix Proposals: Narrow Review-Only Baseline

**Status:** experimental Draft PR #93. **No automatic recommendations, file writes, shell commands, code execution, package upgrades or verified fix claims.** The canonical UCE engine, issues, severities and scores are unchanged.

## Why T6 starts narrow

A wrong automatic runtime/dependency update could break a developer's entire project. T5 hypotheses are **not established root causes**, and T3 native solver agreement is not runtime proof. Therefore T6 supports only a conservative, explicitly **developer-requested Node major pin preview** tied to a restricted, source-backed Node engine disagreement.

### Acceptance preconditions

- The developer supplies an exact `hypothesisId`, a `runtime-pin-vs-engine` fact ID from a freshly derived T5/T2 report, the corresponding same-workspace `package.json` and `.nvmrc`/`.node-version` paths, an exact SHA-256 hash of the current pin content, and a desired `requestedMajor`.
- The entire supplied source inventory must pass T2/T4/T5 bounded completeness and match a caller-pinned SHA-256 inventory hash; this **does not independently authenticate a Git commit or branch**.
- The referenced T2 runtime fact must be `review-required` / `modeled-disjoint`. The original pin must be a single-line plain numeric major optionally prefixed with `v`, with an optional trailing newline. The manifest engine must be in the small explicit major-only model (`>=N`, `<N` or exact `N`); the developer's requested target must satisfy it and differ from the old major.
- Duplicate or competing requests for the same pin file are all rejected rather than silently choosing a winning fix. Unsupported semver, untrusted paths, ambiguous sources, partial scans, stale hashes or unverifiable relationships lead to **Rejected**, never an auto-fix.
- Every offered preview has a bounded `oldText` and `newText` of **one Node major pin line** and a review-only diff with placeholder filename. The artifact contains that tiny pin content; **it is not a private-source redaction guarantee**, even though arbitrary project source is not copied.

### Safe outcome

The developer-selected major yields an explicit, narrow source-hashed diff **proposal**, not a claim that it is the correct runtime. It carries a **high-risk review classification**, impacted toolchain/runtime/dependency/deployment areas, source snapshot and proposed snapshot hashes and a manual precondition/test/rollback checklist. It does **not** write a file, execute `npm ci`, build/run project code or approve a patch. Output always retains `proposalVerified: false`, `projectBuildTested: false`, `runtimeVerified: false`, `developerApproved: false` and `automaticallyApplicable: false`.

**No silent auto-fixes. No unsafe node-version guessing. No claim that a manifest major mismatch is a confirmed root cause.** A reviewer must manually evaluate all relevant environments, lockfile and dependencies before using any diff. T6 never updates UCE issues/scoring or triggers production.

### Reproducibility

```sh
npm ci
node --test testing/trilogy-t6/*.test.mjs
node testing/trilogy-t6/run.mjs --output=trilogy-t6-report.json
```

The dedicated workflow also re-runs T0–T5, frozen corpus, T6 positive/negative tests and uploads bounded artifact. Original UCE Full CI, CodeQL and unchanged self-scan warning gate must pass at the **same commit**.

### What T6 is not

- Not comprehensive compatibility remediation across frameworks, security, build, deploy or languages.
- Not automated determination of an optimal Node version.
- Not independently measured fix correctness, precision/recall or false-positive/false-negative improvement.
- Not actual Git source-commit authentication, independent dependency risk analysis, sandboxed clean build, runtime test, rollback execution or owner acceptance.

These are follow-up gates. Native Linux delegated cgroup tests and broader disk/network/Windows isolation (#77), independent blinded accuracy review (#80), realistic memory/performance (#81) remain open. This phase cannot be production enabled without independent evidence and owner approval.
