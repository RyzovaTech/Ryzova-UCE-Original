import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { load } from '../../scripts/trusted-module-loader.mjs';

// Trusted in-memory TypeScript loader; never execute untrusted scanned files.
const { buildUnifiedBrowserReport } = load('src/lib/report/unified-intelligence.ts');
const { validateBrowserEvidenceBundle, makeDeveloperPatchRequest } = load('src/lib/report/phase5-patch-request.ts');
const sample = () => ({
  score: { overall: 84 }, summary: { name: 'app' },
  issues: [
    { id: 'uce-a', title: 'Runtime issue A', category: 'runtime',
      severity: 'warning', affectedFile: 'package.json', reason: 'Node requirement source', recommendation: 'Review target' },
    { id: 'uce-b', title: 'Runtime issue B', category: 'runtime',
      severity: 'info', affectedFile: '.nvmrc', reason: 'Source pin', recommendation: 'Review pin' },
  ],
  stack: {
    dependencyIntelligence: { risks: [{ name: 'alpha', source: 'package.json', kind: 'wildcard',
      version: '*', severity: 'warning', recommendation: 'Pin dependency' }] },
    technologyDetections: [{
      id: 'fw-react', kind: 'framework', name: 'React', confidence: 90,
      evidence: [{ source: 'package.json', kind: 'manifest', description: 'React declaration', weight: 1 }],
    }],
  },
});
const bundle = () => ({
  fileName: 'unit', files: [
    { path: 'package.json', content: '{"dependencies":{"alpha":"^1.0.0"}}' },
    { path: 'package-lock.json', content: '{"lockfileVersion":3,"packages":{}}' },
    { path: '.nvmrc', content: '20.0.0\n' },
  ],
});

test('browser unified report preserves source and score, distinguishes contexts from review findings', () => {
  const report = sample();
  const prior = JSON.stringify(report);
  const result = buildUnifiedBrowserReport(report);
  assert.equal(result.version, 1);
  assert.equal(result.originalScore, 84);
  assert.equal(result.originalIssueCount, 2);
  assert.ok(result.findings.some(f => f.origin === 'Trilogy' &&
    f.domain === 'dependencies' && f.sourceRefs.includes('package.json')));
  assert.ok(result.findings.some(f => f.domain === 'framework' &&
    f.contextOnly && f.verification === 'not-run'));
  assert.ok(result.rootGroups.some(g => g.id === 'review-cluster:runtime'));
  assert.ok(result.rootGroups.every(g => g.disclaimer.includes('NOT a confirmed shared root cause')));
  assert.equal(result.findings.filter(f => f.origin === 'UCE').length, 2);
  assert.equal(JSON.stringify(report), prior);
});

test('browser grouping never suppresses distinct same-title claims or ungrouped framework context', () => {
  const r = sample();
  r.issues[1].title = r.issues[0].title;
  const out = buildUnifiedBrowserReport(r);
  assert.equal(out.findings.filter(f => f.origin === 'UCE').length, 2);
  const framework = out.findings.find(f => f.domain === 'framework');
  assert.ok(framework && out.ungroupedIds.includes(framework.id));
  assert.ok(out.findings.every(f => f.verification === 'not-run'));
});

test('Both origin requires exact issue type, source, title and evidence, never promotes verification', () => {
  const r = sample();
  r.issues.push({ id: 'uce-risk', title: 'Dependency declaration review: alpha',
    category: 'dependencies', severity: 'warning', affectedFile: 'package.json',
    reason: 'wildcard declaration for alpha (*)', recommendation: 'Review' });
  const out = buildUnifiedBrowserReport(r);
  const result = out.findings.filter(f => f.title === 'Dependency declaration review: alpha');
  assert.equal(result.length, 1);
  assert.equal(result[0].origin, 'Both');
  assert.equal(result[0].verification, 'not-run');
  assert.ok(result[0].sourceIssueIds.includes('trilogy:dependency:0:wildcard'));
  assert.equal(r.issues.length, 3, 'original UCE issue array was not changed');
});

test('invalid source paths and missing provenance never create supported extra findings', () => {
  const r = sample();
  r.stack.dependencyIntelligence.risks[0].source = '../private';
  r.stack.technologyDetections[0].evidence[0].source = '../foreign';
  const out = buildUnifiedBrowserReport(r);
  assert.equal(out.findings.filter(f => f.origin === 'Trilogy').length, 0);
  assert.equal(out.findings.filter(f => f.origin === 'UCE').length, 2);
});

test('framework or dependency references only in docs/tests cannot be promoted to project findings', () => {
  const r = sample();
  r.stack.dependencyIntelligence.risks[0].source = 'examples/package.json';
  r.stack.technologyDetections[0].evidence[0].source = 'docs/example/package.json';
  const out = buildUnifiedBrowserReport(r);
  assert.ok(!out.findings.some(f => f.origin === 'Trilogy'));
  assert.equal(out.originalIssueCount, 2);
});

test('browser request SHA is deterministic, user-selected and contains no generated diff', async () => {
  if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
  const files = bundle();
  const prior = JSON.stringify(files);
  const result = await makeDeveloperPatchRequest(files, '22.0.0');
  assert.equal(result.request.action, 'generate-fix-proposal');
  assert.equal(result.request.targetFile, '.nvmrc');
  assert.equal(result.request.targetVersion, '22.0.0');
  assert.equal(result.request.expectedSha256, createHash('sha256').update('20.0.0\n').digest('hex'));
  assert.deepEqual(result.cliInput.request, result.request);
  assert.equal(JSON.stringify(files), prior);
  assert.ok(!JSON.stringify(result).includes('"diff"'));
});

test('browser proposal preparation rejects unsafe, duplicate, stale-like and dynamic sources', async () => {
  if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
  for (const change of [
    d => { d.files[0].path = '../package.json'; },
    d => { d.files.push({ path: '.node-version', content: '20.0.0\n' }); },
    d => { d.files[2].content = 'lts/*\n'; },
    d => { d.files[1].content = 'x'.repeat(1024 * 1024 + 2); },
    d => { d.files[0].path = '.nvmrc'; },
  ]) {
    const data = bundle(); change(data);
    assert.throws(() => validateBrowserEvidenceBundle(data));
  }
  for (const target of ['22', '^22.0.0', '22.0.0-rc.1', '22.0.0+foo',
    '999999999999999.0.0', '20.0.0']) {
    await assert.rejects(() => makeDeveloperPatchRequest(bundle(), target), undefined, target);
  }
});

test('browser fusion never hides a severity conflict despite exact same source and evidence', () => {
  const r = sample();
  r.issues.push({ id: 'uce-risk', title: 'Dependency declaration review: alpha',
    category: 'dependencies', severity: 'critical', affectedFile: 'package.json',
    reason: 'wildcard declaration for alpha (*)', recommendation: 'Review' });
  const before = JSON.stringify(r);
  const out = buildUnifiedBrowserReport(r);
  const matches = out.findings.filter(f => f.title === 'Dependency declaration review: alpha');
  assert.equal(matches.length, 2);
  assert.deepEqual(new Set(matches.map(f => f.severity)), new Set(['critical', 'warning']));
  assert.ok(matches.some(f => f.origin === 'UCE'));
  assert.ok(matches.some(f => f.origin === 'Trilogy'));
  assert.equal(JSON.stringify(r), before);
});

test('ambiguous UCE records with same evidence remain independent rather than arbitrarily merging', () => {
  const r = sample();
  const base = { title: 'Dependency declaration review: alpha',
    severity: 'warning', affectedFile: 'package.json',
    reason: 'wildcard declaration for alpha (*)', recommendation: 'Review' };
  r.issues.push({ ...base, id: 'uce-risk-a', category: 'dependency-a' });
  r.issues.push({ ...base, id: 'uce-risk-b', category: 'dependency-b' });
  const out = buildUnifiedBrowserReport(r);
  const matches = out.findings.filter(f => f.title === base.title);
  assert.equal(matches.length, 3);
  assert.equal(matches.filter(f => f.origin === 'UCE').length, 2);
  assert.equal(matches.filter(f => f.origin === 'Trilogy').length, 1);
  assert.ok(matches.every(f => f.verification === 'not-run'));
});

test('provenance exposes saved source line without claiming source text or solver proof', () => {
  const r = sample();
  r.issues[0].affectedFile = 'package.json:17';
  const out = buildUnifiedBrowserReport(r);
  const native = out.findings.find(f => f.id === 'uce:compatibility:uce-a');
  assert.ok(native);
  assert.deepEqual(native.sourceRefs, ['package.json#L17']);
  assert.deepEqual(native.sourceIssueIds, ['compatibility:uce-a']);
  assert.equal(native.evidenceStatus, 'report-reference');
  assert.equal(native.verification, 'not-run');
  const risk = out.findings.find(f => f.origin === 'Trilogy' && f.domain === 'dependencies');
  assert.equal(risk.evidenceStatus, 'extracted-metadata');
  assert.match(risk.potentialImpact, /unknown/);
  assert.equal(out.originalScore, 84);
  assert.equal(r.issues[0].affectedFile, 'package.json:17');
});

test('original UCE raw issue records remain accessible even when workspace deduplication hides a mirror', () => {
  const r = sample();
  r.issues.push({ ...r.issues[0], id: 'distinct-issue', reason: 'Different original evidence' });
  const before = JSON.stringify(r);
  const out = buildUnifiedBrowserReport(r);
  assert.equal(out.originalIssueCount, 3);
  assert.equal(out.originalIssues.length, 3);
  assert.equal(out.originalIssues[2].id, 'distinct-issue');
  assert.equal(out.originalIssues[2].reason, 'Different original evidence');
  assert.equal(out.originalScore, 84);
  assert.equal(JSON.stringify(r), before);
});

test('workspace display cap is disclosed without dropping original UCE record access', () => {
  const r = sample();
  for (let i = 0; i < 1004; i++) {
    r.issues.push({ id: 'bulk-' + i, title: 'Distinct issue ' + i, category: 'runtime',
      severity: 'info', affectedFile: 'src/item-' + i + '.js',
      reason: 'Source ' + i, recommendation: 'Manual review' });
  }
  const out = buildUnifiedBrowserReport(r);
  assert.equal(out.originalIssueCount, 1006);
  assert.equal(out.originalIssues.length, 1006);
  assert.equal(out.omittedWorkspaceFindings, 6);
  assert.equal(out.findings.filter(f => f.origin === 'UCE').length, 1000);
});
