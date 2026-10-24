import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { evaluatePhase5Intelligence } from '../phase5-evaluation.mjs';

const issue = (id, severity = 'warning') => ({
  id, title: 'Pinned Node mismatch', category: 'runtime',
  severity, affectedFile: '.nvmrc', recommendation: 'Review',
});
const native = (id, severity = 'warning') => ({
  id: 'uce:' + id, origin: 'UCE', origins: ['UCE'],
  title: 'Pinned Node mismatch', file: '.nvmrc', severity,
  sourceIssueIds: [id], evidenceRefs: [], verification: 'not-run',
});
const trilogy = () => ({
  id: 'trilogy:node:1', origin: 'Trilogy', origins: ['Trilogy'],
  title: 'Conflicting declared Node version pins', severity: 'warning',
  file: '.node-version', sourceIssueIds: [], verification: 'not-run',
  evidenceRefs: ['.nvmrc', '.node-version'], contextOnly: false,
});
const report = () => ({ score: { overall: 87 }, issues: [issue('a')] });
const scan = () => ({
  version: 1, status: 'ok', graphStatus: 'ok',
  originalScore: 87, originalIssueCount: 1,
  findings: [native('a'), trilogy()], rootCauses: [],
  patchTargets: [], limitations: [],
});

test('baseline audit is deterministic, read-only and never fabricates accuracy metrics', () => {
  const r = report(), s = scan();
  const before = JSON.stringify({ r, s });
  const a = evaluatePhase5Intelligence(r, s);
  assert.equal(a.structuralStatus, 'passed', JSON.stringify(a.flags));
  assert.equal(a.graphCoverage, 'bounded-modeled-graph');
  assert.equal(a.originalScoreParity, 'preserved');
  assert.equal(a.originalIssueParity, 'preserved');
  assert.equal(a.counts.originalIssues, 1);
  assert.equal(a.counts.trilogyOnly, 1);
  assert.equal(a.counts.both, 0);
  assert.equal(a.counts.sourceLinked, 1);
  assert.equal(a.counts.trilogyWithoutSource, 0);
  assert.equal(a.reviewQueue.length, 1);
  for (const metric of ['falsePositiveRate', 'falseMergeRate',
    'usefulNewFindingRate', 'recommendationCorrectnessRate']) {
    assert.equal(a.accuracy[metric], null);
  }
  assert.equal(JSON.stringify({ r, s }), before);
  assert.deepEqual(a, evaluatePhase5Intelligence(r, s));
  assert.ok(!JSON.stringify(a).includes('"diff"'));
});

test('score/count tampering and erased original links are independently flagged', () => {
  const s = scan();
  s.originalScore = 99;
  s.originalIssueCount = 0;
  s.findings[0].sourceIssueIds = [];
  const a = evaluatePhase5Intelligence(report(), s);
  assert.equal(a.structuralStatus, 'review-required');
  assert.equal(a.originalScoreParity, 'mismatch');
  assert.equal(a.originalIssueParity, 'mismatch');
  const kinds = a.flags.map(x => x.code);
  assert.ok(kinds.includes('original-score-mismatch'));
  assert.ok(kinds.includes('original-issue-count-mismatch'));
  assert.ok(kinds.includes('original-record-not-preserved-exactly-once'));
});

test('native severity, title and source-record identity cannot silently drift', () => {
  const s = scan();
  s.findings[0].severity = 'critical';
  s.findings[0].title = 'Changed title';
  const a = evaluatePhase5Intelligence(report(), s);
  assert.ok(a.flags.some(f => f.code === 'original-record-content-or-severity-drift'));
  assert.equal(a.counts.originalIssues, 1);
});

test('ambiguous native issue identities and duplicate display records are review-required', () => {
  const r = report(), s = scan();
  r.issues.push(issue('a'));
  s.originalIssueCount = 2;
  s.findings.push({ ...native('a'), id: 'uce:duplicate-a' });
  const a = evaluatePhase5Intelligence(r, s);
  assert.equal(a.structuralStatus, 'review-required');
  assert.ok(a.flags.some(f => f.code === 'ambiguous-original-issue-id'));
  assert.ok(a.flags.some(f => f.code === 'original-record-not-preserved-exactly-once'));
});

test('shared Both label remains a human-review candidate and does not imply verified fix', () => {
  const s = scan();
  s.findings[0] = {
    ...native('a'), origin: 'Both', origins: ['UCE', 'Trilogy'],
    relatedTrilogyIds: ['trilogy:node:1'],
    evidenceRefs: ['.nvmrc', 'package-lock.json#packages'],
  };
  const a = evaluatePhase5Intelligence(report(), s);
  assert.equal(a.structuralStatus, 'passed', JSON.stringify(a.flags));
  assert.equal(a.counts.both, 1);
  assert.equal(a.reviewQueue.length, 2);
  assert.equal(a.accuracy.falseMergeRate, null);
  s.findings[0].relatedTrilogyIds = [];
  assert.ok(evaluatePhase5Intelligence(report(), s).flags.some(x =>
    x.code === 'merged-finding-lacks-trilogy-correlation-id'));
});

test('invalid or absent Trilogy source references never count as verified evidence', () => {
  const s = scan();
  s.findings[1].evidenceRefs = ['../secret.txt'];
  let a = evaluatePhase5Intelligence(report(), s);
  assert.equal(a.structuralStatus, 'review-required');
  assert.ok(a.flags.some(x => x.code === 'invalid-source-provenance'));
  assert.equal(a.counts.invalidSource, 1);
  s.findings[1].evidenceRefs = [];
  a = evaluatePhase5Intelligence(report(), s);
  assert.equal(a.counts.trilogyWithoutSource, 1);
  assert.equal(a.structuralStatus, 'review-required');
  assert.ok(a.flags.some(x => x.code === 'trilogy-finding-lacks-source-reference'));
  assert.equal(a.reviewQueue[0].evidenceStatus, 'review-provenance');
  assert.equal(a.accuracy.falsePositiveRate, null);
});

test('partial graph stays Unknown and cannot advertise new findings or patches', () => {
  const s = scan();
  s.status = 'partial';
  s.graphStatus = 'unknown';
  s.findings = [native('a')];
  const a = evaluatePhase5Intelligence(report(), s);
  assert.equal(a.structuralStatus, 'passed');
  assert.equal(a.graphCoverage, 'unknown');
  assert.equal(a.counts.trilogyOnly, 0);
  assert.equal(a.accuracy.usefulNewFindingRate, null);
  s.patchTargets = [{ file: '.nvmrc' }];
  assert.ok(evaluatePhase5Intelligence(report(), s).flags.some(x =>
    x.code === 'partial-graph-claims-extra-intelligence-or-patch'));
  s.patchTargets = [];
  s.rootCauses = [{ id: 'fake', proofStatus: 'not-run', findingIds: ['uce:a'] }];
  assert.ok(evaluatePhase5Intelligence(report(), s).flags.some(x =>
    x.code === 'partial-graph-claims-extra-intelligence-or-patch'));
});

test('claimed solver verification and invalid cluster references remain review failures', () => {
  const s = scan();
  s.findings[1].verification = 'formally-verified';
  s.rootCauses = [{ id: 'root-1', findingIds: ['not-present'],
    proofStatus: 'verified' }];
  const a = evaluatePhase5Intelligence(report(), s);
  assert.ok(a.flags.some(x => x.code === 'unsubstantiated-verification-claim'));
  assert.ok(a.flags.some(x => x.code === 'invalid-investigation-cluster-link'));
  assert.ok(a.flags.some(x => x.code === 'unsubstantiated-cluster-proof-claim'));
});

test('malformed or over-budget scans abstain instead of asserting parity', () => {
  const s = scan();
  delete s.findings;
  let a = evaluatePhase5Intelligence(report(), s);
  assert.equal(a.structuralStatus, 'unknown');
  assert.equal(a.originalScoreParity, 'unknown');
  assert.equal(a.counts, null);
  a = evaluatePhase5Intelligence({ score: { overall: 87 },
    issues: Array.from({ length: 513 }, (_, i) => issue(String(i))) }, scan());
  assert.equal(a.structuralStatus, 'unknown');
  assert.equal(a.accuracy.recommendationCorrectnessRate, null);
});


test('explicit evaluate CLI executes original UCE in read-only mode and reports unknown accuracy', () => {
  const cli = new URL('../phase5-cli.mjs', import.meta.url);
  const input = new URL('../fixtures/optional-project.json', import.meta.url);
  const process = spawnSync(globalThis.process.execPath,
    [cli.pathname, 'evaluate', input.pathname],
    { encoding: 'utf8', timeout: 20000, maxBuffer: 512 * 1024 });
  assert.equal(process.status, 0, process.stderr);
  const out = JSON.parse(process.stdout);
  assert.equal(out.version, 1);
  assert.equal(out.originalScoreParity, 'preserved');
  assert.equal(out.originalIssueParity, 'preserved');
  assert.equal(out.accuracy.falsePositiveRate, null);
  assert.equal(out.accuracy.falseMergeRate, null);
  assert.ok(['passed', 'review-required'].includes(out.structuralStatus),
    JSON.stringify(out.flags));
  assert.ok(!process.stdout.includes('"diff"'));
  assert.ok(!process.stdout.includes('"proposal"'));
});
