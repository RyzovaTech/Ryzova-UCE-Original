import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { decisionMetrics as metrics, groupMetrics, checkRegression } from './metrics.mjs';
import { load } from '../../scripts/trusted-module-loader.mjs';

const { detectRegisteredTechnologies } = load('src/lib/analyzer/technology-registry.ts');
const { detectStack } = load('src/lib/analyzer/detectors.ts');
const { parseFiles } = load('src/lib/analyzer/parser.ts');
const { detectSecurityIntelligence } = load('src/lib/analyzer/security-intelligence.ts');
const raw = fs.readFileSync(new URL('./corpus.json', import.meta.url), 'utf8');
const corpus = JSON.parse(raw);
const ids = new Set();
const results = corpus.cases.map(item => {
  if (ids.has(item.id)) throw Error(`Duplicate benchmark ID ${item.id}`);
  ids.add(item.id);
  if (!item.rationale || !item.labelReview || !item.files.length) throw Error(`Incomplete label ${item.id}`);
  if (item.source.kind.startsWith('real-') && !/^[a-f0-9]{40}$/.test(item.source.commit)) throw Error(`Unpinned source ${item.id}`);
  const files = item.files.map(file => ({ ...file, size: Buffer.byteLength(file.content), isDirectory: false }));
  const actual = item.area === 'security'
    ? detectSecurityIntelligence(files).findings.some(finding => finding.ruleId === item.rule)
    : item.area === 'technology' ? detectRegisteredTechnologies(files).some(detection => detection.name === item.technology)
    : detectStack(files, parseFiles(files)).packageManager;
  return { id: item.id, area: item.area, ecosystem: item.ecosystem, kind: item.source.kind, expected: item.expected, actual, passed: actual === item.expected };
});
const { ANALYSIS_CACHE_VERSION } = load('src/lib/analyzer/execution.ts');
const report = { engineVersion: JSON.parse(fs.readFileSync(new URL('../../package.json',import.meta.url),'utf8')).version, analysisCacheVersion: ANALYSIS_CACHE_VERSION, schemaVersion: 1, benchmark: corpus.name, corpusSha256: createHash('sha256').update(raw).digest('hex'),
  scope: corpus.scope, globalAccuracy: null, humanReviewedCases: 0,
  modules: Object.fromEntries([...new Set(results.map(row=>row.area))].map(area=>[area,metrics(results.filter(row=>row.area===area))])),
  ecosystems: groupMetrics(results, 'ecosystem'),
  strata: Object.fromEntries([...new Set(results.map(row=>row.kind))].map(kind=>[kind,metrics(results.filter(row=>row.kind===kind))])),
  unmeasuredModules: ['architecture','code','runtime','platform','build','testing','performance','accessibility','api','database','environment','deployment','license','documentation','maintainability','repository','browser'],
  results };
if (process.argv.includes('--record')) fs.writeFileSync(new URL('./baseline.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
if (process.argv.includes('--check')) {
  const baseline=JSON.parse(fs.readFileSync(new URL('./baseline.json',import.meta.url),'utf8'));
  checkRegression(baseline, report);
}
console.log(JSON.stringify(report,null,2));
