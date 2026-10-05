import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { load } from '../../scripts/trusted-module-loader.mjs';
import { decisionMetrics, groupMetrics, checkRegression } from '../accuracy/metrics.mjs';
const { detectSecurityIntelligence } = load('src/lib/analyzer/security-intelligence.ts');
const raw = fs.readFileSync(new URL('./false-positive-corpus.json', import.meta.url), 'utf8');
const corpus = JSON.parse(raw), ids = new Set();
const results = corpus.cases.map(item => {
  if (ids.has(item.id) || typeof item.expected !== 'boolean' || !item.rationale || !item.files.length) throw Error(`Invalid label ${item.id}`);
  ids.add(item.id);
  const files = item.files.map(file => ({ ...file, size: Buffer.byteLength(file.content), isDirectory: false }));
  const actual = detectSecurityIntelligence(files).findings.some(finding => finding.ruleId === item.rule);
  return { id: item.id, ecosystem: item.ecosystem, family: item.rule, scenario: item.scenario, expected: item.expected, actual, passed: item.expected === actual };
});
const report = { benchmark: corpus.name, corpusSha256: createHash('sha256').update(raw).digest('hex'),
  globalAccuracy: null, reviewStatus: 'agent-provisional', humanReviewedCases: 0, scope: corpus.scope,
  metrics: decisionMetrics(results), ecosystems: groupMetrics(results, 'ecosystem'), families: groupMetrics(results, 'family'), failures: results.filter(row => !row.passed), results };
const baseline = new URL('./false-positive-baseline.json', import.meta.url);
if (process.argv.includes('--record')) fs.writeFileSync(baseline, JSON.stringify(report, null, 2) + '\n');
if (process.argv.includes('--check')) { checkRegression(JSON.parse(fs.readFileSync(baseline)), report); if (report.failures.length) throw Error(`Security context failures: ${report.failures.map(row => row.id)}`); }
console.log(JSON.stringify(report, null, 2));
