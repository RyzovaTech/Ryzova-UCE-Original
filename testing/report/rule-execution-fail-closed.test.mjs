import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from '../../scripts/trusted-module-loader.mjs';

const { ALL_RULES } = load('src/lib/compatibility/rules/index.ts');
const { runAnalysisWithDiagnostics } = load('src/lib/compatibility/analysis/engine.ts');
const { analyzeProject } = load('src/lib/analyzer/analyzer.ts');
const { describeReportReadiness } = load('src/lib/report/readiness.ts');
const { exportMarkdown } = load('src/lib/report/export.ts');
const file = (name, content) => ({ path: name, content, size: Buffer.byteLength(content), isDirectory: false });
const files = () => [
  file('package.json', '{"name":"rule-failure-fixture","version":"1.0.0","scripts":{"build":"vite build"}}'),
  file('src/index.ts', 'export const ready = true;'),
];
const input = () => {
  const items = files();
  return { files: items, fileName: 'rule-failure-fixture', source: 'upload',
    scanStats: { projectSize: items.reduce((n, f) => n + f.size, 0), filesFound: items.length,
      filesAnalyzed: items.length, filesIgnored: 0, ignoredCategories: [] } };
};
const badRule = { id: 'phase1-intentional-crash', category: 'structure',
  run: () => { throw new Error('sensitive example source: must not be copied into the report'); } };

test('a rule exception is recorded as unknown, not a defect or a healthy category', () => {
  const knownIssue = { id: 'phase1-known-warning', title: 'Observed warning',
    category: 'structure', severity: 'warning', description: 'Known',
    reason: 'Observed evidence', recommendation: 'Review', affectedFile: 'src/index.ts' };
  const knownRule = { id: 'phase1-known-rule', category: 'structure', run: () => [knownIssue] };
  const ctx = { files: files(), detectedFiles: [], projectName: 'fixture',
    stack: { language: 'TypeScript', runtime: 'Node.js', packageManager: 'npm' } };
  const { categories, failures } = runAnalysisWithDiagnostics(ctx, [knownRule, badRule]);
  const structure = categories.find(c => c.id === 'structure');
  assert.deepEqual(failures, [{ ruleId: badRule.id, category: 'structure', kind: 'exception' }]);
  assert.equal(structure.status, 'unknown');
  assert.equal(structure.score, 0);
  assert.deepEqual(structure.issues, [knownIssue], 'previously observed issues must remain visible');
  assert.match(structure.summary, /Incomplete/);
  assert.ok(!JSON.stringify(failures).includes('sensitive example source'));
});

test('healthy rule execution retains normal score and no failure diagnostics', () => {
  const ctx = { files: files(), detectedFiles: [], projectName: 'fixture',
    stack: { language: 'TypeScript', runtime: 'Node.js', packageManager: 'npm' } };
  const ok = { id: 'phase1-ok', category: 'structure', run: () => [] };
  const { categories, failures } = runAnalysisWithDiagnostics(ctx, [ok]);
  assert.deepEqual(failures, []);
  assert.equal(categories.find(c => c.id === 'structure').status, 'good');
  assert.equal(categories.find(c => c.id === 'structure').score, 100);
});

test('canonical report is partial and hides readiness score after a compatibility rule crash', () => {
  const baseline = analyzeProject(input());
  ALL_RULES.push(badRule);
  let report;
  try { report = analyzeProject(input()); }
  finally { ALL_RULES.pop(); }
  assert.equal(report.summary.scanStats.ruleFailures.length, 1);
  assert.deepEqual(report.summary.scanStats.ruleFailures[0],
    { ruleId: badRule.id, category: 'structure', kind: 'exception' });
  assert.equal(report.categories.find(c => c.id === 'structure').status, 'unknown');
  assert.equal(report.score.applicableCategories.includes('structure'), false);
  assert.deepEqual(report.issues.filter(i => i.category !== 'structure'),
    baseline.issues.filter(i => i.category !== 'structure'));
  assert.equal(report.summary.analysisCoverage.status, 'partial');
  assert.equal(report.summary.scanStats.truncated, true);
  assert.equal(describeReportReadiness(report).partial, true);
  assert.equal(describeReportReadiness(report).displayScore, null);
  assert.match(describeReportReadiness(report).coverage, /execution failure/);
  assert.match(exportMarkdown(report), /Not established — partial scan/);
  assert.ok(!JSON.stringify(report).includes('sensitive example source'));
});

test('UEC CI gate rejects a report with failed rules even if its numeric score is 100', () => {
  const report = analyzeProject(input());
  report.score.overall = 100;
  report.summary.scanStats.ruleFailures = [{ ruleId: badRule.id, category: 'structure', kind: 'exception' }];
  const dir = mkdtempSync(path.join(tmpdir(), 'uce-phase1-'));
  const target = path.join(dir, 'report.json');
  try {
    writeFileSync(target, JSON.stringify(report));
    const cwd = fileURLToPath(new URL('../..', import.meta.url));
    const cmd = spawnSync(process.execPath, ['scripts/uce-ci.mjs', target, '--min-score=0',
      '--max-critical=999999', '--max-warning=999999'], { cwd, encoding: 'utf8' });
    assert.equal(cmd.status, 1, cmd.stderr);
    assert.match(cmd.stderr, /compatibility rule execution failure/);
    const invalid = { ...report, summary: { ...report.summary,
      scanStats: { ...report.summary.scanStats, ruleFailures: 'not-an-array' } } };
    writeFileSync(target, JSON.stringify(invalid));
    const corrupt = spawnSync(process.execPath, ['scripts/uce-ci.mjs', target],
      { cwd, encoding: 'utf8' });
    assert.equal(corrupt.status, 2);
    assert.match(corrupt.stderr, /ruleFailures must contain valid/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
