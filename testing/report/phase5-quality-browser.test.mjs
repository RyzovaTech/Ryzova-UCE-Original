import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../../scripts/trusted-module-loader.mjs';

const { buildUnifiedBrowserReport } = load('src/lib/report/unified-intelligence.ts');
const { evaluateBrowserQuality } = load('src/lib/report/phase5-quality.ts');
const sample = () => ({
  id: 'test-report', score: { overall: 84 },
  issues: [
    { id: 'native-a', title: 'Declared runtime review', category: 'runtime',
      severity: 'warning', affectedFile: '.nvmrc', reason: 'local pin',
      recommendation: 'Review' },
    { id: 'native-b', title: 'Other runtime review', category: 'runtime',
      severity: 'info', affectedFile: 'package.json', reason: 'local manifest',
      recommendation: 'Review' },
  ],
  stack: {
    dependencyIntelligence: { risks: [{
      name: 'alpha', source: 'package.json', kind: 'wildcard',
      version: '*', severity: 'warning', recommendation: 'Review dependency',
    }] },
    technologyDetections: [],
  },
});

test('browser audit checks original parity without mutating the input or manufacturing accuracy', () => {
  const report = sample(), before = JSON.stringify(report);
  const model = buildUnifiedBrowserReport(report), old = JSON.stringify(model);
  const audit = evaluateBrowserQuality(report, model);
  assert.equal(audit.status, 'passed-structural-checks', JSON.stringify(audit.flags));
  assert.equal(audit.scoreParity, 'preserved');
  assert.equal(audit.originalIssueParity, 'preserved');
  assert.equal(audit.scope, 'browser-derived-report-only');
  assert.equal(audit.counts.uce, 2);
  assert.equal(audit.counts.trilogy, 1);
  assert.equal(audit.counts.candidatesTotal, 1);
  assert.equal(audit.reviewQueue[0].evidence, 'source-reference');
  assert.equal(audit.accuracy.falsePositiveRate, null);
  assert.equal(audit.accuracy.falseMergeRate, null);
  assert.equal(audit.accuracy.recommendationCorrectness, null);
  assert.equal(JSON.stringify(report), before);
  assert.equal(JSON.stringify(model), old);
  assert.deepEqual(audit, evaluateBrowserQuality(report, model));
});

test('browser audit fails closed for changes to native score and raw issue records', () => {
  const report = sample(), model = buildUnifiedBrowserReport(report);
  model.originalScore = 100;
  model.originalIssues[0].severity = 'critical';
  const out = evaluateBrowserQuality(report, model);
  assert.equal(out.status, 'review-required');
  assert.equal(out.scoreParity, 'mismatch');
  assert.equal(out.originalIssueParity, 'mismatch');
  assert.deepEqual(out.flags.map(f => f.code).slice(0, 2),
    ['original-score-mismatch', 'original-issue-record-drift']);
});

test('unsafe and absent Trilogy provenance are review flags, never verified evidence', () => {
  const report = sample(), model = buildUnifiedBrowserReport(report);
  const t = model.findings.find(f => f.origin === 'Trilogy');
  assert.ok(t);
  t.sourceRefs = ['../secret-file'];
  let audit = evaluateBrowserQuality(report, model);
  assert.equal(audit.status, 'review-required');
  assert.ok(audit.flags.some(f => f.code === 'invalid-source-reference'));
  assert.equal(audit.counts.missingTrilogySources, 1);
  t.sourceRefs = [];
  audit = evaluateBrowserQuality(report, model);
  assert.ok(audit.flags.some(f => f.code === 'trilogy-evidence-reference-missing'));
  assert.equal(audit.reviewQueue[0].evidence, 'missing-or-unsafe');
});

test('Both requires explicit dual source provenance; no title-only fusion certificate', () => {
  const report = sample(), model = buildUnifiedBrowserReport(report);
  const t = model.findings.find(f => f.origin === 'Trilogy');
  t.origin = 'Both';
  t.sourceIssueIds = [];
  const out = evaluateBrowserQuality(report, model);
  assert.equal(out.status, 'review-required');
  assert.ok(out.flags.some(f => f.code === 'ambiguous-both-record-provenance'));
  assert.equal(out.accuracy.falseMergeRate, null);
});

test('group links and browser verification cannot be promoted to solver proofs', () => {
  const report = sample(), model = buildUnifiedBrowserReport(report);
  model.rootGroups[0].findingIds.push('nonexistent');
  model.findings[0].verification = 'formally-verified';
  const out = evaluateBrowserQuality(report, model);
  assert.ok(out.flags.some(f => f.code === 'unresolved-investigation-link'));
  assert.ok(out.flags.some(f => f.code === 'unsupported-browser-proof-claim'));
});

test('local UCE symbolic counts are displayed as reported static constraints', () => {
  const report = sample();
  report.stack.symbolicReasoning = {
    version: 1, counts: { conflict: 1, satisfiable: 2, unknown: 3 },
    decisions: [], limited: true, limitations: [],
  };
  const out = evaluateBrowserQuality(report, buildUnifiedBrowserReport(report));
  assert.equal(out.symbolic.localStatus, 'recorded');
  assert.equal(out.symbolic.conflict, 1);
  assert.equal(out.symbolic.satisfiable, 2);
  assert.equal(out.symbolic.unknown, 3);
  assert.equal(out.symbolic.limited, true);
  assert.equal(out.symbolic.solverVerification, 'not-run');
  assert.equal(out.symbolic.diagnosticSource, 'none');
});

test('saved optional SMT diagnostic is not automatically converted to browser proof', () => {
  const report = sample();
  report.optionalSolver = {
    engine: 'Souffle+Z3+cvc5', enabled: true, attempted: true,
    status: 'satisfiable', verification: 'independent-smt-agreement',
  };
  const out = evaluateBrowserQuality(report, buildUnifiedBrowserReport(report));
  assert.equal(out.symbolic.diagnosticSource, 'saved-report-only');
  assert.equal(out.symbolic.solverVerification, 'reported-independent-smt-agreement');
  assert.ok(out.limitations.some(x => x.includes('not re-run')));
  assert.ok(!out.reviewQueue.some(x => x.evidence === 'verified'));
  report.optionalSolver.attempted = false;
  assert.equal(evaluateBrowserQuality(report, buildUnifiedBrowserReport(report))
    .symbolic.solverVerification, 'not-run');
});

test('review queue remains capped and contextual findings are not silently dropped', () => {
  const report = sample(), model = buildUnifiedBrowserReport(report);
  for (let i = 0; i < 56; i++) {
    model.findings.push({
      id: 'trilogy:extra:' + i, title: 'Supplemental review ' + i,
      origin: 'Trilogy', severity: 'info', domain: 'runtime',
      file: 'package.json', evidence: 'Saved metadata',
      recommendation: 'Inspect', verification: 'not-run',
      evidenceLevel: 'uce-extracted-dependency',
      evidenceStatus: 'extracted-metadata',
      sourceRefs: ['package.json'], sourceIssueIds: [],
      contextOnly: false, potentialImpact: 'Unknown',
    });
  }
  const out = evaluateBrowserQuality(report, model);
  assert.equal(out.counts.candidatesTotal, 57);
  assert.equal(out.counts.candidatesShown, 40);
  assert.equal(out.reviewQueue.length, 40);
  assert.ok(out.reviewQueue.every(candidate => candidate.origin === 'Trilogy'));
  assert.equal(out.accuracy.usefulFindingRate, null);
});
