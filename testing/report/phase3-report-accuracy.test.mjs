import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../../scripts/trusted-module-loader.mjs';

const { collectWorkspaceFindings, compareReports, findingFingerprint } =
  load('src/lib/report/workspace.ts');
const { buildUnifiedBrowserReport } = load('src/lib/report/unified-intelligence.ts');
const { evaluateBrowserQuality } = load('src/lib/report/phase5-quality.ts');
const { describeReportReadiness } = load('src/lib/report/readiness.ts');
const { exportJson, exportMarkdown, exportSarif } = load('src/lib/report/export.ts');

const issue = (id, reason = 'observed evidence', severity = 'warning') => ({
  id, title: 'Identical issue title', severity, category: 'runtime',
  affectedFile: 'src/start.ts:4', description: 'Scoped static check',
  reason, recommendation: 'Review the exact source',
});
const report = (id = 'phase3-fixture') => ({
  id, createdAt: '2026-10-26T00:00:00.000Z', analysisVersion: '3.0.0-beta.1',
  classification: { type: 'Software Project', isSoftware: true, reason: 'Fixture' },
  summary: {
    name: 'same-project',
    scanStats: { projectSize: 20, filesFound: 1, filesAnalyzed: 1,
      filesIgnored: 0, ignoredCategories: [] },
    analysisCoverage: { status: 'full', filesFound: 1, filesAnalyzed: 1, fileCoveragePercent: 100 },
  },
  detectedFiles: [], categories: [
    { id: 'runtime', label: 'Runtime', status: 'warning', score: 80, issues: [], summary: 'Review' },
    { id: 'security', label: 'Security', status: 'unknown', score: 0, issues: [], summary: 'Not applicable' },
  ],
  issues: [], score: { overall: 84, runtime: 80, security: 0, applicableCategories: ['runtime'] },
  stack: {}, notes: [], timeline: [], source: 'upload',
});

const v3 = (packId, ruleId, detail, severity = 'warning') => ({
  packId, ruleId, title: 'Identical V3 title', module: 'security', severity,
  confidence: 'possible', file: 'src/start.ts', line: 4,
  evidence: [{ detector: 'regex', file: 'src/start.ts', line: 4, detail }],
  recommendation: 'Inspect source context before drawing conclusions',
  falsePositiveNotes: [],
});
const v3Platform = (findings, metrics = []) => ({
  schemaVersion: 1, packIds: [], rulesConsidered: findings.length,
  rulesExecuted: findings.length, rulesSkipped: 0, findings, metrics,
  limitations: ['Static checks do not prove runtime behavior'],
});

test('all V3 phases retain pack/rule/evidence provenance; no phase-name filter or scoring changes', () => {
  const r = report();
  r.stack.v3RulePlatform = v3Platform([
    v3('catalog.v3-phase2.runtime', 'rule.one', 'Evidence A'),
    v3('catalog.v3-phase3.security', 'rule.two', 'Evidence B'),
    v3('catalog.v3-phase4.security', 'rule.three', 'Evidence C'),
    v3('catalog.v3-phase5.security', 'rule.four', 'Evidence D'),
    v3('future.catalog', 'rule.five', 'Evidence E'),
  ]);
  const original = JSON.stringify(r);
  const workspace = collectWorkspaceFindings(r);
  assert.equal(workspace.length, 5);
  assert.deepEqual(workspace.map(f => f.packId), r.stack.v3RulePlatform.findings.map(f => f.packId));
  assert.ok(workspace.every(f => f.id.startsWith('v3:') && f.ruleId && f.evidence && f.line === 4));
  const browser = buildUnifiedBrowserReport(r);
  assert.equal(browser.originalScore, 84);
  assert.equal(browser.originalIssueCount, 0);
  assert.equal(browser.findings.filter(f => f.origin === 'UCE').length, 5);
  assert.equal(browser.omittedWorkspaceFindings, 0);
  assert.ok(browser.limitations.some(s => s.includes('NOT included in the original weighted core')));
  assert.equal(JSON.stringify(r), original);
  const sarif = JSON.parse(exportSarif(r));
  assert.equal(sarif.runs[0].results.length, 5);
  assert.equal(sarif.runs[0].tool.driver.rules.length, 5);
  assert.match(exportMarkdown(r), /V3 and supplementary intelligence findings are separate static observations/);
  assert.equal(exportJson(r), JSON.stringify(r, null, 2));
});

test('distinct identical-title issues and distinct V3 evidence are never silently deduplicated', () => {
  const r = report();
  r.issues = [issue('native-alpha', 'Reason A'), issue('native-beta', 'Reason B')];
  r.stack.v3RulePlatform = v3Platform([
    v3('catalog.v3-phase2.security', 'same.rule', 'Independent evidence A'),
    v3('catalog.v3-phase2.security', 'same.rule', 'Independent evidence B'),
  ]);
  const found = collectWorkspaceFindings(r);
  assert.equal(found.length, 4);
  assert.equal(new Set(found.map(f => f.id)).size, 4);
  assert.equal(new Set(found.map(findingFingerprint)).size, 4);
  const browser = buildUnifiedBrowserReport(r);
  assert.equal(browser.findings.filter(f => f.origin === 'UCE').length, 4);
  assert.deepEqual(browser.originalIssues.map(f => f.id), ['native-alpha', 'native-beta']);
  assert.equal(browser.originalIssueCount, 2);
});

test('orphaned legacy security issues are retained but proven source mirrors are suppressed', () => {
  const r = report();
  r.issues = [
    issue('security-intelligence-orphan', 'Orphan source'),
    issue('security-intelligence-present', 'Canonical mirror'),
    issue('other-native', 'Independent'),
  ];
  r.stack.securityIntelligence = {
    score: 80, filesScanned: 1, rulesExecuted: 1,
    findings: [{ id: 'security-a', ruleId: 'present', title: 'Canonical security observation',
      severity: 'warning', file: 'src/start.ts', line: 4, evidence: 'Evidence',
      recommendation: 'Review' }],
  };
  const found = collectWorkspaceFindings(r);
  assert.ok(found.some(f => f.id === 'compatibility:security-intelligence-orphan'));
  assert.ok(found.some(f => f.id === 'security:security-a'));
  assert.ok(!found.some(f => f.id === 'compatibility:security-intelligence-present'));
  assert.equal(found.length, 3);
  assert.equal(r.issues.length, 3, 'raw canonical issue records remain immutable');
});

test('partial/unknown coverage cannot imply scores improved or findings were resolved', () => {
  const old = report('old'), current = report('new');
  old.issues = [issue('previous-observation')];
  current.issues = [issue('new-observation')];
  old.score.overall = 70;
  current.score.overall = 95;
  current.summary.analysisCoverage.status = 'partial';
  current.summary.scanStats.ruleFailures = [
    { ruleId: 'intentional-rule-crash', category: 'runtime', kind: 'exception' },
  ];
  const before = JSON.stringify([old, current]);
  const comparison = compareReports(current, old);
  assert.equal(comparison.scoreComparable, false);
  assert.equal(comparison.resolutionComparable, false);
  assert.equal(comparison.scoreDelta, null);
  assert.deepEqual(comparison.resolvedFindings, []);
  assert.equal(comparison.newFindings.length, 1);
  assert.ok(comparison.categoryDeltas.every(c => c.delta === null && c.current === null));
  assert.equal(describeReportReadiness(current).displayScore, null);
  assert.equal(evaluateBrowserQuality(current, buildUnifiedBrowserReport(current)).graphCoverage, 'unknown');
  assert.equal(JSON.stringify([old, current]), before);
});

test('fully assessed reports keep truthful score deltas but unknown category is not compared', () => {
  const old = report('old'), current = report('new');
  old.score.overall = 73;
  current.score.overall = 85;
  old.issues = [issue('resolved-observation')];
  current.issues = [issue('fresh-observation')];
  const compared = compareReports(current, old);
  assert.equal(compared.scoreComparable, true);
  assert.equal(compared.scoreDelta, 12);
  assert.equal(compared.resolutionComparable, true);
  assert.equal(compared.resolvedFindings.length, 1);
  assert.equal(compared.newFindings.length, 1);
  assert.equal(compared.categoryDeltas[0].delta, 0);
  assert.equal(compared.categoryDeltas[1].delta, null);
});

test('V3 budgets, incomplete archive sweeps and finding limits remain unknown independently of file coverage', () => {
  const r = report();
  r.stack.v3RulePlatform = v3Platform([v3('new.v3', 'warning', 'Evidence')], [
    { ruleId: 'warning', filesVisited: 1, contentBytes: 20,
      matches: 1, durationMs: 0, truncated: true },
  ]);
  assert.equal(describeReportReadiness(r).partial, true);
  assert.equal(evaluateBrowserQuality(r, buildUnifiedBrowserReport(r)).graphCoverage, 'unknown');
  r.stack.v3RulePlatform.metrics = [];
  r.stack.v3RulePlatform.archiveSweep = { complete: false, findingsOmitted: 0,
    rulesChecked: 1, filesChecked: 1, dependencyFilesChecked: 0, ruleFileVisits: 1 };
  assert.equal(describeReportReadiness(r).partial, true);
  r.stack.v3RulePlatform.archiveSweep.complete = true;
  r.stack.v3RulePlatform.archiveSweep.findingsOmitted = 2;
  assert.equal(describeReportReadiness(r).partial, true);
});

test('browser cap prioritizes critical V3 observations rather than hiding them after 1000 info records', () => {
  const r = report();
  r.issues = Array.from({ length: 1000 }, (_, i) => ({
    ...issue('info-' + i, 'Reason ' + i, 'info'),
    title: 'Info ' + i, affectedFile: 'src/item-' + i + '.ts',
  }));
  r.stack.v3RulePlatform = v3Platform([v3('v3-phase2', 'critical-source', 'Review', 'critical')]);
  const model = buildUnifiedBrowserReport(r);
  assert.equal(model.originalIssueCount, 1000);
  assert.equal(model.originalIssues.length, 1000);
  assert.equal(model.omittedWorkspaceFindings, 1);
  assert.ok(model.findings.some(f => f.id.includes('critical-source') && f.severity === 'critical'));
  assert.equal(model.findings.filter(f => f.origin === 'UCE').length, 1000);
});
