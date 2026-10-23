import { createHash } from 'node:crypto';
import semver from 'semver';
import { inspectSmartEvidence } from './evidence-inspector.mjs';

const MAX_UCE_ISSUES = 512;
const MAX_TRILOGY_FINDINGS = 128;
const idHash = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
const normalized = value => typeof value === 'string'
  ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';
const simpleFile = value => typeof value === 'string' &&
  /^[a-zA-Z0-9_.@/-]{1,160}$/.test(value) &&
  value.split('/').every(part => part && part !== '.' && part !== '..');
const severity = value => ['critical', 'warning', 'info'].includes(value) ? value : 'info';
const findingIdentity = item => [
  normalized(item.module), normalized(item.title), normalized(item.file),
].join('|');
const rank = value => ({ critical: 0, warning: 1, info: 2 })[value] ?? 3;
const unknown = (reason, originals, score) => ({
  version: 1, status: 'partial', graphStatus: 'unknown', reason,
  originalScore: score, originalIssueCount: originals.length,
  findings: originals, rootCauses: [], patchTargets: [],
  limitations: ['Independent discovery unavailable; original UCE findings are preserved.'],
});

/**
 * Phase 5 experimental, read-only intelligence. No new UCE score or issue
 * mutation, native solver invocation, project code execution or writes.
 * Root cause groups express source-linked associations, NOT causal proofs.
 */
export function buildUnifiedIntelligence(report, files, options = {}) {
  const issues = report?.issues;
  if (!Array.isArray(issues) || issues.length > MAX_UCE_ISSUES) {
    return unknown('invalid-or-over-budget-original-issues', [],
      Number.isFinite(report?.score?.overall) ? report.score.overall : null);
  }
  const originals = issues.map((issue, index) => ({
    id: 'uce:' + String(issue?.id ?? index).slice(0, 100),
    origin: 'UCE', origins: ['UCE'],
    module: normalized(issue?.category) || 'unknown',
    title: typeof issue?.title === 'string' ? issue.title.slice(0, 200) : 'Unnamed UCE issue',
    file: typeof issue?.affectedFile === 'string' ? issue.affectedFile.slice(0, 200) : '',
    severity: severity(issue?.severity),
    verification: 'not-run', evidenceLevel: 'original-uce-analysis',
    evidenceRefs: [], sourceIssueIds: [String(issue?.id ?? index).slice(0, 100)],
    recommendation: typeof issue?.recommendation === 'string'
      ? issue.recommendation.slice(0, 600) : '',
    rootCauseId: null,
  }));
  const score = Number.isFinite(report?.score?.overall) ? report.score.overall : null;
  const inspection = inspectSmartEvidence(files, options.workspace ?? '');
  if (!inspection.eligible || !inspection.graph) {
    const result = unknown(inspection.reason || 'unsupported-source-graph', originals, score);
    result.graphStatus = inspection.status;
    return result;
  }
  const graph = inspection.graph;
  const constraints = graph.constraints;
  const found = [];
  const scope = graph.workspace;
  const add = item => {
    if (found.length < MAX_TRILOGY_FINDINGS) found.push({
      ...item, origin: 'Trilogy', origins: ['Trilogy'], module: 'runtime',
      severity: 'warning', verification: 'not-run',
      evidenceLevel: 'source-backed-static-model',
      rootCauseId: 'runtime-node:' + (scope || 'root'),
    });
  };

  // A disjoint pair is an evidence-backed static contradiction between
  // declared ranges, not proof of installation/build/runtime failure.
  for (let i = 0; i < constraints.length; i++) {
    for (let j = i + 1; j < constraints.length; j++) {
      const a = constraints[i], b = constraints[j];
      if (!semver.intersects(a.range, b.range, { includePrerelease: false })) {
        add({
          id: 'trilogy:node-ranges:' + idHash([scope, a.source, a.key, a.range,
            b.source, b.key, b.range].join('|')),
          title: 'Incompatible modeled Node requirements',
          file: a.source.split('#')[0],
          evidenceRefs: [a.source, b.source],
          sourceIssueIds: [],
          constraints: [{ id: a.id, key: a.key, range: a.range, source: a.source },
            { id: b.id, key: b.key, range: b.range, source: b.source }],
          recommendation: 'Review the conflicting Node declarations. A formal proof or actual build outcome has not been established.',
        });
      }
    }
  }

  // A pinned runtime outside any complete mandatory graph requirement is a
  // separate independent discovery (and a candidate for on-demand review).
  const names = [(scope ? scope + '/' : '') + '.nvmrc',
    (scope ? scope + '/' : '') + '.node-version'];
  const pins = Array.isArray(files) ? files.filter(f => names.includes(f?.path)) : [];
  for (const pin of pins) {
    if (typeof pin.content !== 'string' || pin.content.length > 128) continue;
    const version = pin.content.trim().replace(/^v/, '');
    if (!semver.valid(version) || semver.prerelease(version) ||
        semver.parse(version).build.length) continue;
    const violating = constraints.filter(c => !semver.satisfies(version, c.range));
    if (!violating.length) continue;
    add({
      id: 'trilogy:pinned-runtime:' + idHash([scope, pin.path, version,
        ...violating.map(c => c.id + ':' + c.range)].join('|')),
      title: 'Declared Node runtime pin does not satisfy mandatory requirements',
      file: pin.path,
      evidenceRefs: [pin.path, ...violating.map(c => c.source)],
      sourceIssueIds: [],
      recommendation: 'Review the pinned runtime and modeled Node requirements. Request a read-only fix proposal after selecting a supported target version.',
      pinnedVersion: version,
    });
  }

  // Preserve every source issue; only merge identical normalized claims
  // with identical affected file and category. No title-only fuzzy merges.
  const fused = [];
  const byKey = new Map();
  for (const item of [...originals, ...found]) {
    const key = findingIdentity(item);
    const other = byKey.get(key);
    if (other && other.origin !== item.origin && other.origin !== 'Both') {
      other.origin = 'Both';
      other.origins = ['UCE', 'Trilogy'];
      other.evidenceRefs = [...new Set([...other.evidenceRefs, ...item.evidenceRefs])];
      other.sourceIssueIds = [...new Set([...other.sourceIssueIds, ...item.sourceIssueIds])];
      // Preserve native issue severity, original text and confidence; never
      // promote a UCE finding to formally verified from shared wording.
      other.relatedTrilogyIds = [...(other.relatedTrilogyIds ?? []), item.id];
      other.rootCauseId = item.rootCauseId;
    } else {
      fused.push({ ...item });
      if (!other) byKey.set(key, fused[fused.length - 1]);
    }
  }

  const related = fused.filter(f => f.rootCauseId);
  const rootCauses = related.length ? [{
    id: 'runtime-node:' + (scope || 'root'),
    title: 'Modeled Node runtime relationships',
    relationship: 'related-by-source-backed-runtime-model',
    proofStatus: 'not-run',
    findingIds: related.map(f => f.id),
    severity: related.some(f => f.severity === 'critical') ? 'critical' : 'warning',
    recommendation: 'Investigate Node requirements, runtime pins and affected build/deployment targets before choosing a fix.',
  }] : [];

  const patchTargets = pins.filter(p => simpleFile(p.path) &&
      typeof p.content === 'string' && p.content.length <= 128)
    .map(p => ({ file: p.path, sha256: createHash('sha256')
      .update(p.content).digest('hex'), action: 'request-generate-fix-proposal' }));

  fused.sort((a, b) => rank(a.severity) - rank(b.severity) ||
    a.id.localeCompare(b.id));
  return {
    version: 1, status: 'ok', graphStatus: 'ok',
    reason: '', originalScore: score, originalIssueCount: issues.length,
    findings: fused, rootCauses, patchTargets,
    evidenceDigest: inspection.digest,
    limitations: [
      'Source-backed relationships are not causal or runtime proofs.',
      'No formal solver stage ran during this static intelligence pass.',
      'No patch generation occurs during this scan.',
      'Original UCE issue collection and score remain unchanged.',
    ],
  };
}
