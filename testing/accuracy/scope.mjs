import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { load } from '../../scripts/trusted-module-loader.mjs';
import { decisionMetrics, groupMetrics, checkRegression } from './metrics.mjs';
const { detectRegisteredTechnologies } = load('src/lib/analyzer/technology-registry.ts');
const { detectSecurityIntelligence } = load('src/lib/analyzer/security-intelligence.ts');
const { classifyProjectFileScope } = load('src/lib/analyzer/project-scope.ts');
const raw = fs.readFileSync(new URL('./scope-corpus.json', import.meta.url), 'utf8');
const corpus = JSON.parse(raw), ids = new Set();
if (corpus.schemaVersion !== 1 || !corpus.cases?.length) throw Error('Invalid scope corpus');
const results = corpus.cases.map(item => {
  if (!item.id || ids.has(item.id) || typeof item.expected !== 'boolean' || !item.rationale || !item.labelReview || item.source?.kind !== 'synthetic-contract' || !item.files?.length)
    throw Error(`Invalid scope label: ${item.id}`);
  ids.add(item.id);
  if (!['technology', 'security'].includes(item.area) || !(item.area === 'technology' ? item.technology : item.rule)) throw Error(`Unsupported area: ${item.id}`);
  const paths = new Set();
  const files = item.files.map(file => {
    if (!file.path || file.path.startsWith('/') || file.path.includes('\\') || file.path.split('/').includes('..') || paths.has(file.path) || typeof file.content !== 'string') throw Error(`Invalid file: ${item.id}`);
    paths.add(file.path);
    return { ...file, size: Buffer.byteLength(file.content), isDirectory: false };
  });
  const actualScope = classifyProjectFileScope(files[0].path);
  const actual = item.area === 'technology'
    ? detectRegisteredTechnologies(files).some(row => row.name === item.technology)
    : detectSecurityIntelligence(files).findings.some(row => row.ruleId === item.rule);
  return { id: item.id, area: item.area, ecosystem: item.ecosystem, scope: item.scope, family: item.source.family,
    expected: item.expected, actual, passed: item.expected === actual, expectedScope: item.scope, actualScope };
});
const scopeDecisions = results.map(row => ({ ...row, expected: row.expectedScope, actual: row.actualScope }));
const report = { schemaVersion: 1, benchmark: corpus.name, corpusSha256: createHash('sha256').update(raw).digest('hex'),
  engineVersion: JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url))).version,
  scope: corpus.scope, globalAccuracy: null, reviewStatus: 'agent-provisional', humanReviewedCases: 0,
  metrics: decisionMetrics(results), modules: groupMetrics(results, 'area'), ecosystems: groupMetrics(results, 'ecosystem'),
  scopes: groupMetrics(results, 'scope'), families: groupMetrics(results, 'family'), scopeClassification: decisionMetrics(scopeDecisions),
  failures: results.filter(row => !row.passed || row.actualScope !== row.expectedScope), results };
const url = new URL('./scope-baseline.json', import.meta.url);
if (process.argv.includes('--record')) fs.writeFileSync(url, JSON.stringify(report, null, 2) + '\n');
if (process.argv.includes('--check')) {
  const baseline = JSON.parse(fs.readFileSync(url));
  checkRegression(baseline, report);
  checkRegression({ ...baseline, results: baseline.results.map(row => ({ ...row, expected: row.expectedScope, actual: row.actualScope, passed: row.expectedScope === row.actualScope })) },
    { ...report, results: scopeDecisions.map(row => ({ ...row, passed: row.expected === row.actual })) });
}
if (process.argv.includes('--output')) fs.writeFileSync(new URL('./scope-current.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
