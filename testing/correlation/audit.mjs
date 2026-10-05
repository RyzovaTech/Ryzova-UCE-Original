import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { load } from '../../scripts/trusted-module-loader.mjs';
import { decisionMetrics, groupMetrics, checkRegression } from '../accuracy/metrics.mjs';
const { executeV3RulePacks } = load('src/lib/knowledge/v3-sdk.ts');
const { V3_PHASE4_RULE_PACKS } = load('src/lib/knowledge/v3-phase4-packs.ts');
const { versionCorrelationRules } = load('src/lib/compatibility/rules/version-correlation.ts');
const rules = V3_PHASE4_RULE_PACKS.flatMap(pack => pack.rules);
const selected = {
  lock: rules.find(rule => rule.detectors[0].mode === 'lockfile-version' && rule.detectors[0].packageName === 'react'),
  module: rules.find(rule => rule.detectors[0].semantic === 'node-module-typescript'),
};
const raw = fs.readFileSync(new URL('./corpus.json', import.meta.url), 'utf8');
const corpus = JSON.parse(raw), ids = new Set();
const results = corpus.cases.map(item => {
  if (!item.id || ids.has(item.id) || typeof item.expected !== 'boolean' || !item.rationale || !item.files?.length || !['runtime','lock','module'].includes(item.family)) throw Error(`Invalid contract ${item.id}`);
  ids.add(item.id);
  const files = item.files.map(file => ({ ...file, size: Buffer.byteLength(file.content), isDirectory: false }));
  let actual;
  if (item.family === 'runtime') actual = versionCorrelationRules[0].run({ files, detectedFiles: [], stack: {}, projectName: 'contracts' }).length > 0;
  else {
    const rule = selected[item.family];
    const pack = { schemaVersion: 3, id: 'org.ryzova.phase4.audit', name: 'Contracts', version: '3.0.0', publisher: 'RyzovaTech', description: 'Synthetic contracts', uceCompatibility: '>=2.0.0 <4.0.0', technologies: rule.technologies, modules: [rule.module], rules: [rule] };
    actual = executeV3RulePacks([pack], { files, technologies: rule.technologies }).findings.length > 0;
  }
  return { id: item.id, ecosystem: item.ecosystem, family: item.family, expected: item.expected, actual, passed: item.expected === actual };
});
const report = { benchmark: corpus.name, corpusSha256: createHash('sha256').update(raw).digest('hex'), scope: corpus.scope, globalAccuracy: null, humanReviewedCases: 0, reviewStatus: 'agent-provisional', metrics: decisionMetrics(results), families: groupMetrics(results, 'family'), results };
const baseline = new URL('./baseline.json', import.meta.url);
if (process.argv.includes('--record')) fs.writeFileSync(baseline, JSON.stringify(report, null, 2) + '\n');
if (process.argv.includes('--check')) { checkRegression(JSON.parse(fs.readFileSync(baseline)), report); if (results.some(row => !row.passed)) throw Error('Correlation contract failed'); }
console.log(JSON.stringify(report,null,2));
