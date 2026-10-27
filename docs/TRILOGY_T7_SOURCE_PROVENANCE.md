# Trilogy T7 — Local Git Source Provenance Audit

**Scope:** Experimental read-only Git object-chain verification. This is a source-integrity prerequisite, **not** independently authenticated GitHub identity, independent human adjudication, or measured real-world accuracy. PR #93 remains Draft and production remains HOLD.

## Purpose

A 40-hex commit string and SHA-256 in user JSON do not demonstrate a genuine pinned source snapshot. The `source-provenance.mjs` module cryptographically checks the **raw Git SHA-1 commit object**, its root and nested tree objects, the exact named **regular-file blob**, and the SHA-256 of the full file against the frozen T7 case manifest. All Git objects are read using bounded `git cat-file` calls. It never checks out code, invokes source/build scripts or solvers, follows symlinks/submodules, contacts a network, modifies source or rewrites original UCE scoring.

The provided Git checkout may itself be fabricated, rebased, cloned from an unverified remote, or unrelated to the repository alias. **Only a separately independent external authority can authenticate remote repository identity, repository revision, selection frame, and human-review evidence.** Git SHA-1 is legacy integrity, not a signed-source authority; the full-file SHA-256 protects the file content against SHA-1-only reliance. A single case anchors one complete regular file; multi-file case evidence requires a separately reviewed extension.

## Run locally

Use Node 20+ and Git; keep real code and reviewer materials off public CI artifacts. The frozen T7 manifest uses the T7 v1 case schema (`studyId`, `cases[]` with `id`, `repositoryAlias`, `commitSha`, `sourceEvidenceSha256`, etc.). For each case prepare a private source registry:

```json
{
  "schemaVersion": 1,
  "studyId": "example-study",
  "cases": [
    {
      "caseId": "case-001",
      "repositoryAlias": "independent-repo-alias",
      "repositoryDirectory": "/absolute/local/checkout",
      "commitSha": "40-character-lowercase-hex",
      "treeSha": "40-character-lowercase-hex",
      "blobSha": "40-character-lowercase-hex",
      "sourcePath": "src/example.js"
    }
  ]
}
```

Pins must be real hexadecimal hashes, **not** the explanatory placeholder strings above. `sourceEvidenceSha256` in the manifest is SHA-256 of the complete blob bytes at `sourcePath`, not an authored excerpt. Source registry must cover every case exactly once. `repositoryDirectory` should be a trusted checkout on an approved local host. Git replacement objects, global/system Git configuration and caller Git directory overrides are disabled for audit subprocesses.

```sh
node --test testing/trilogy-t7/*.test.mjs
node testing/trilogy-t7/verify-sources.mjs \
  --manifest=/secure/t7/frozen.json \
  --registry=/secure/t7/local-source-registry.json \
  --output=/secure/t7/source-provenance-audit.json
```

The optional output path is written **exclusive-create** with restrictive permissions: an existing file is not overwritten. The emitted artifact contains only hashes, opaque case IDs, counts, and non-certified status. It excludes absolute local repo paths, private source bytes and reviewer data. Run the source audit independently of `run.mjs` and retain the output in a controlled evidence store.

## Negative gates

The verifier rejects mismatched case universe, duplicate case IDs, invalid or misattributed aliases, incorrect commit/tree/blob hashes, absent paths, path traversal, non-regular file modes (including symlinks and submodules), stale full-file SHA-256 and oversized Git objects. CI runs only temporary locally generated Git fixtures; this does **not** create external case ground truth. No source registry auto-upgrades `measuredIndependentRealWorldAccuracy: null` or `overallReleaseReady: false`.

**Next independent tasks:** preregister a representative public real-repository sampling frame, have a separate reviewer authenticate repository origins and immutable revisions, acquire two blinded human assessments per case with third-party resolution, and run paired UCE vs UCE+Trilogy output over exactly that universe. Do not merge or deploy without owner approval.
