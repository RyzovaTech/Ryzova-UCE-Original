# UCE + Trilogy — Phase 1 Public Real-Repository Source Diagnostic

**Status:** Experimental, read-only, preregistered public-repository source pilot. **Not** independently adjudicated accuracy, not a security audit of upstream projects, not a compatibility certification and not a release gate. Do not publish target repository issue titles as confirmed defects.

## Objective and pinned real source

The 27 October 2026 case registry at `testing/real-world-phase1/projects.json` pins real upstream Git SHA-1 commits, not mutable branch references:

| Case | Project | Ecosystem | Exact upstream SHA |
|---|---|---|---|
| express-js | expressjs/express | JavaScript | 1c6f1b0fe4000977b9a7b4f34097e4d527dd9824 |
| flask-py | pallets/flask | Python | d086db856be187255b8ec61ef409357393020f32 |
| ky-ts | sindresorhus/ky | TypeScript | 3541888878c4d303a8bc2ad61815f4e048f55a5d |
| mini-redis-rs | tokio-rs/mini-redis | Rust | 3d93b42bc363220f85af4fc9e1bebd35b588a4a3 |

GitHub Actions checks out exactly each SHA (no submodules/LFS, no persistent Git credentials), installs dependencies **only for UCE**, and **never runs target code, project tests, install scripts, native solvers or build scripts**. The workflow has read-only GitHub permissions. No Vercel deploy or production merge is needed.

## Exactly what is measured

1. Run the canonical `scripts/uce-scan.mjs` on each pinned upstream checkout. Record **raw output counts and original UCE score** as diagnostic signals, *not* verified project errors.
2. Reopen a bounded selection of source files (5,000 max, 4 MiB total, 256 KiB/file; unsupported filename/extension or over-budget sources are excluded or marked unreadable). T2 AST graph and T4 fusion are invoked **with inventoryComplete:false**, so no negative absence proof can be inferred. Only the existing JS/TS graph is supported; Python/Rust graph relationship counts may be zero even if meaningful cross-file dependencies exist.
3. Check each UCE report remains byte-for-byte unmodified; verify identical score, finding count, canonical report hash and supplied source hash in T2 and T4. Enforce T4 `originCounts.Both=0`, no suppressed findings and no applied patches.
4. Emit counts of source observations, unknowns, parse failures, source-review scope and coverage, with hashes and pinned SHA, but **no source code, UCE finding text, secrets or labels**. Upload only derived diagnostic JSON artifacts for a brief retention period.
5. Before interpreting results, inspect scan truncation and T2 source coverage. A reported UCE score is not an independently validated accuracy score. A new T2 source relationship is **not** a newly confirmed UCE detector finding; paired TP/FP/TN/FN cannot be calculated without a frozen claim universe and independent human adjudication.

## Running

Manual: the `Trilogy Phase 1 Real-World Source Diagnostic (Unreviewed)` GitHub workflow supports `workflow_dispatch`; the PR with these files also triggers its `pull_request` job. GitHub Actions will record an exact-head run for PR #93. CLI contracts alone can be tested with:

```sh
node --test testing/real-world-phase1/*.test.mjs
```

Local source-only equivalent once UCE dependencies and registered checkouts are present:

```sh
node scripts/uce-scan.mjs target/express --output=phase1-results/express-js-uce.json
node testing/real-world-phase1/run.mjs \
  --registry=testing/real-world-phase1/projects.json \
  --case=express-js \
  --checkout=target/express \
  --uce-report=phase1-results/express-js-uce.json \
  --output=phase1-results/express-js-paired-diagnostic.json
```

Every checkout must have the registered exact `HEAD`; mutable refs are refused. Output files use exclusive-create permissions. Source content is never written into the published derived diagnostic artifact.

## Evaluation honesty and follow-up

This **Phase 1** uses authentic public repositories but **zero authenticated human truth labels**. Individual raw warnings need review before they can be called false positives; unflagged source does not equal a true negative, and incomplete scan or unsupported ecosystem analysis is `Unknown`, never success. The artifact explicitly retains `independentRealWorldAccuracy:null`, `measuredImprovement:null` and `releaseReady:false`. Any apparent difference between UCE findings and Trilogy relationship candidates is not an accuracy improvement.

**Next Phase 1 follow-up:** inspect the four GitHub Action outputs, identify parser/coverage/Unknown hotspots without promoting candidate defects, then propose conservative false-alert hypotheses for Phase 2. Formal T7 validation still needs preregistered claim-level positives and negatives, verified remote source provenance, distinct blinded human reviewers and resolution of disagreements, plus domain-specific clustered uncertainty. No owner-approved production merge or deploy follows from this pilot.
