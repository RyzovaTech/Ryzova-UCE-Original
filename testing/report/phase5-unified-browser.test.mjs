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

test('invalid source paths and missing provenance never create supported extra findings', () => {
  const r = sample();
  r.stack.dependencyIntelligence.risks[0].source = '../private';
  r.stack.technologyDetections[0].evidence[0].source = '../foreign';
  const out = buildUnifiedBrowserReport(r);
  assert.equal(out.findings.filter(f => f.origin === 'Trilogy').length, 0);
  assert.equal(out.findings.filter(f => f.origin === 'UCE').length, 2);
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
