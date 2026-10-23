import { createHash } from 'node:crypto';
import semver from 'semver';
import { inspectSmartEvidence } from './evidence-inspector.mjs';

const sha = content => createHash('sha256').update(content).digest('hex');
const exactVersion = value => typeof value === 'string' && value.length <= 32 &&
  semver.valid(value, { loose: false }) === value &&
  semver.prerelease(value) === null && semver.parse(value).build.length === 0 &&
  value.split('.').every(part => /^\d+$/.test(part) && Number(part) <= 1000000);
const pinnedLine = /^([ \t]*)(v?)(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)([ \t]*)(\r\n|\n)?$/;
const denied = (reason, status = 'blocked') => ({
  version: 1, status, reason, proposal: null,
});
const pathIn = (workspace, base) => (workspace ? workspace + '/' : '') + base;

/**
 * Explicit-on-request ONLY. Pure, bounded read-only proposal creation.
 * No filesystem writes, subprocesses, package installation or project code
 * execution. The caller must supply an unchanged scan content hash.
 */
export function generateReviewableFixProposal(files, request, options = {}) {
  if (!request || request.action !== 'generate-fix-proposal') {
    return denied('developer-request-required', 'not-requested');
  }
  if (!request || typeof request !== 'object' ||
      !exactVersion(request.targetVersion) ||
      !/^[a-f0-9]{64}$/.test(request.expectedSha256 ?? '')) {
    return denied('invalid-or-missing-target-version-and-scan-hash');
  }
  const inspection = inspectSmartEvidence(files, options.workspace ?? '');
  if (!inspection.eligible || !inspection.graph) {
    return denied('unsupported-or-incomplete-source-model: ' + inspection.reason);
  }
  const graph = inspection.graph;
  const candidates = [pathIn(graph.workspace, '.nvmrc'),
    pathIn(graph.workspace, '.node-version')];
  if (typeof request.targetFile !== 'string' ||
      !candidates.includes(request.targetFile)) {
    return denied('file-outside-v1-allowlist');
  }
  if (!Array.isArray(files)) return denied('invalid-file-collection');
  const pins = files.filter(f => f && candidates.includes(f.path));
  // Updating one of multiple runtime pins leaves another potentially stale.
  if (pins.length !== 1 || pins[0].path !== request.targetFile) {
    return denied('ambiguous-or-multiple-runtime-pin-files');
  }
  const file = pins[0];
  if (file.isDirectory === true || typeof file.content !== 'string' ||
      Buffer.byteLength(file.content) > 128) {
    return denied('unsupported-or-over-budget-runtime-pin');
  }
  if (sha(file.content) !== request.expectedSha256) {
    return denied('stale-source-hash', 'stale');
  }
  const matched = pinnedLine.exec(file.content);
  if (!matched) return denied('noncanonical-or-dynamic-runtime-pin');
  const originalVersion = matched[3] + '.' + matched[4] + '.' + matched[5];
  if (!exactVersion(originalVersion)) return denied('invalid-source-runtime-version');
  if (originalVersion === request.targetVersion) return denied('no-change-required');

  const facts = graph.constraints;
  if (facts.length < 2 || facts.length > 32) return denied('over-or-under-constrained-model');
  if (!facts.every(f => semver.satisfies(request.targetVersion, f.range,
    { includePrerelease: false }))) {
    return denied('target-not-compatible-with-all-modeled-requirements');
  }
  if (facts.every(f => semver.satisfies(originalVersion, f.range,
    { includePrerelease: false }))) {
    return denied('current-pin-has-no-modeled-constraint-mismatch');
  }
  const after = matched[1] + matched[2] + request.targetVersion +
    matched[6] + (matched[7] ?? '');
  if (after === file.content) return denied('no-change-required');
  const beforeSha256 = sha(file.content);
  const afterSha256 = sha(after);
  const proposalId = 'trilogy-fix:' + sha([graph.workspace, file.path,
    beforeSha256, afterSha256, inspection.digest].join('|')).slice(0, 20);

  return {
    version: 1, status: 'proposed', reason: '',
    proposal: {
      id: proposalId, targetFile: file.path, sourceSha256: beforeSha256,
      proposedSha256: afterSha256, oldVersion: originalVersion,
      newVersion: request.targetVersion, modelEvidenceDigest: inspection.digest,
      origin: 'Trilogy', patchFormat: 'unified-diff-preview',
      diff: '--- a/' + file.path + '\n+++ b/' + file.path + '\n@@ -1 +1 @@\n-' +
        matched[1] + matched[2] + originalVersion + matched[6] + '\n+' +
        matched[1] + matched[2] + request.targetVersion + matched[6] + '\n',
      evidenceRefs: [file.path, ...new Set(facts.map(f => f.source))],
      verification: {
        status: 'static-semver-check-only',
        modeledConstraintsSatisfied: true,
        formalProof: false,
        buildOrRuntimeTested: false,
      },
      risk: {
        level: 'requires-review',
        factors: ['CI, deployment and framework compatibility not tested',
          'npm engine declarations do not prove install/runtime behavior',
          'Other runtime pins or externally configured versions may exist'],
      },
      validationPlan: [
        'Inspect the original file and exact source evidence.',
        'Confirm CI, framework, deployment and actual target Node support.',
        'Apply any approved change manually in a controlled checkout.',
        'Run project tests and builds; compare UCE analysis after the change.',
      ],
      applySupported: false,
      limitations: ['Preview/export only; project bytes were not modified.'],
    },
  };
}
