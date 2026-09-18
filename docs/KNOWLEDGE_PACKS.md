# UCE Knowledge Packs

Knowledge packs are versioned manifests that describe deterministic detection
rules without granting network or code-execution access. Schema version 1 is
defined in `schemas/knowledge-pack.schema.json`.

## Trust model

- Built-in packs ship with UCE and are trusted as part of the application release.
- Imported community and organization packs are untrusted by default.
- An unsigned pack may be inspected and validated but must not be enabled silently.
- Signed imports use an Ed25519 signature envelope with a SHA-256 digest.
- `verifyKnowledgePack` establishes publisher trust by checking the canonical SHA-256
  digest and Ed25519 signature against a revocation-aware organization trust store.
- Knowledge packs cannot request network access or execute arbitrary project code.

## Permissions

The v1 allowlist is limited to reading supplied project files, emitting findings,
and declaring technology or compatibility knowledge. Unknown permissions invalidate
the pack.

## Rule descriptors

### Technology

Dependency, manifest, configuration, import, and structure-based technology rules.

### Security

Static security-sensitive patterns. Findings require review and are not proof of
an exploitable vulnerability.

### Browser

Web API, JavaScript, and CSS compatibility knowledge evaluated against targets.

### Compatibility

Runtime, dependency, configuration, structure, environment, deployment, and
performance checks used by the compatibility score.

### Intelligence

Project, platform, testing, accessibility, API, database, documentation, and
maintainability intelligence modules.

## Import and export

`importKnowledgePack`, `exportKnowledgePack`, `validateKnowledgePack`, registry bundle
import/export, and the declarative detector SDK provide the v1 deterministic contract.
Duplicate rule IDs, malformed versions, unsupported permissions, invalid signatures,
unknown schema versions, unsafe paths, and unbounded patterns are rejected.
