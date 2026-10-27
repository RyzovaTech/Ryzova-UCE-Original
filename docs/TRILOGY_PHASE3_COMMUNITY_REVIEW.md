# Trilogy Phase 3 — Volunteer Independent Review Recruitment and Blinding

**Status:** recruitment and offline reviewer-evidence protocol only. No reviewers recruited or independently verified. No validated accuracy increase. Release **HOLD**. Experimental PR #93 remains Draft; [accuracy gate #80](https://github.com/RyzovaTech/Ryzova-UCE-Original/issues/80) remains open.

## How volunteers join without knowing the maintainer personally

A public **volunteer interest** GitHub issue invites contributors to comment only `I'm interested — preferred area: JS/TS, Python, Rust or general compatibility`. No private email, legal name, employer, identity documents, unpublished code or review verdict should be posted in the issue. The project owner then checks contributor suitability and possible conflicts **outside the public issue** and establishes an agreed secure contact and evidence-transfer method. This repository does not currently provide an authenticated private review portal.

An independent reviewer should have relevant technical experience, must not have contributed to the specific detector/claim under review, and must avoid consulting UCE/Trilogy outputs or other volunteers' votes until their blinded review is sealed. Public GitHub visibility means these conditions **cannot be enforced by software**: if any reviewer already saw the predictions, mark that case contaminated/ineligible and reassign. The volunteer may withdraw at any time. Never treat bots or two AI agents as two human reviewers.

## Pre-registration and case preparation

1. Owner and an external auditor agree on *neutral* claim definitions and representative selection logic **before** evaluating UCE/Trilogy outputs. Include claims that ultimately turn out positive, negative and unknown; do not use only UCE-flagged issues. Maintain selection rationale privately and freeze a signed/approved study version and sampling frame. Phase 1 source candidates from Express, Flask, Ky and Mini-Redis are **unreviewed diagnostic leads**, not unbiased positive truth labels.
2. Create a T7-compatible manifest JSON with `schemaVersion:1`, `studyId`, `protocolSha256`, `samplingFrameSha256` and `cases`. Each case has `id`, `repositoryAlias`, `commitSha`, `sourceEvidenceSha256`, `domain`, `severity`, `ecosystem`. Immutable full-file hashes must correspond to the pinned public Git checkout. Include **no expected label or prediction**.
3. Create a matching private claim registry with `schemaVersion:1`, the same `studyId`, and `claims`, each with `caseId`, `repositoryAlias`, public `repository` (owner/name), `sourcePath`, and a neutral `claimText` question. Source path and Git SHA must be immutable. Only one clear binary proposition per case, with an explicit option for unknown evidence. The local packet builder rejects leaked `expected`, `truth`, extra prediction fields, mutable Git refs, path traversal and missing cases. **A neutral-looking question can still bias a reviewer**; independent external protocol review is required before distribution.
4. For each case, distribute the *same* `blinded-claim-review` packet independently to two eligible, distinct human volunteers. Do not include raw UCE outputs, score, severity, evidence fusion status, Trilogy candidates, source-rule assertions or another reviewer's label. The packet carries a pinned public source URL and a declared SHA-256; external source authenticity remains separately auditable.

### Local packet generation (never upload real reviewer records to public CI)

```sh
node --test testing/community-review/*.test.mjs
node testing/community-review/run.mjs \
  --manifest=/secure/study/frozen-manifest.json \
  --claims=/secure/study/neutral-claims.json \
  --output=/secure/study/blind-packet-and-intake.json
```

An optional `--reviews=/secure/study/volunteer-submissions.json` reads securely collected blinded votes and creates **aggregate-only** intake counts. The output file is exclusive-create with restrictive permissions. No identities or case-level verdicts appear in the printed intake summary. **Do not publicly upload even the full packet** without manual review for sensitivity, unverified accusations or misleading source descriptions.

## Independent decision and conflict protocol

A secure submissions JSON has `schemaVersion:1`, `studyId`, `reviews` (primary votes), and `adjudications` (third-person votes only for disagreements). Each vote requires `caseId`, opaque `reviewerAlias`, `decision` (`positive`, `negative` or `unknown`), SHA-256 hashes of retained evidence/rationale, and declarations: `blindToPredictions:true`, `blindToPeerVotes:true`, `independentOfUCEDevelopment:true`, and `conflictOfInterest:false`. Collect original rationales privately with timestamps, immutable source pointers and access audit logs; the tool checks hash formats and declared roles only.

Two different reviewer aliases are required. A disagreement needs a third different blinded human adjudicator. An unknown verdict remains unknown; no absent vote is converted to a true negative. If review independence, eligibility, evidence or source authenticity cannot be established, exclude the case from **certified** analysis and preserve it as `Unknown` in the audit trail, without selectively dropping cases from the frozen denominator.

The offline `intake.mjs` enforces distinct aliases, no more than two primary votes per case, no unsolicited third verdicts, no self-declared conflicts or unblinded reviews, and full case-universe identity. It deliberately reports **zero authenticated human identities** even with two matching JSON records: self-declared flags are not proof of a human, independence or authentic blinded collection. The T7 evaluator likewise keeps `measuredIndependentRealWorldAccuracy:null` and `overallReleaseReady:false` pending independent provenance audit.

## Milestones and ownership

- **P3-A — Open recruitment:** publish a public reviewer-interest issue linked to PR #93 and issue #80. Mark the call as unpaid volunteer opportunity unless the maintainer explicitly arranges something else; do not promise compensation.
- **P3-B — Evidence-ready packet:** freeze genuine neutral claim units and external source authentication, then let an independent reviewer inspect the packet for leakage.
- **P3-C — Collect reviews:** two eligible humans per case; third distinct adjudicator for disagreements; private sealed votes and conflict records.
- **P3-D — External audit and paired evaluation:** confirm human identity/blinding/selection criteria, run exactly matched UCE-only vs UCE+Trilogy per-case predictions with repository-cluster-aware uncertainty and assess false-positive/false-negative tradeoffs. **Only then** consider measured accuracy claims; require owner approval before release.

The project owner does **not** need to personally know two reviewers. The community issue is only a recruitment channel, not authentication or proof of completed review. GitHub Actions runs synthetic safety tests only, with no private volunteer material and no changed original UCE rules, scores, production activation or automatic patches.
