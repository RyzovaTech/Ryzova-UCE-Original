import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { load } from '../../scripts/trusted-module-loader.mjs';
import { checkRegression, decisionMetrics, groupMetrics } from '../accuracy/metrics.mjs';
import { evaluateManifestCorpus, projectMetrics, accuracyClaimReadiness } from './evaluation.mjs';
const raw = fs.readFileSync(new URL('./manifest-corpus.json',import.meta.url),'utf8');
const corpus = JSON.parse(raw);
const development = JSON.parse(fs.readFileSync(new URL('../accuracy/corpus.json',import.meta.url),'utf8'));
const previous = JSON.parse(fs.readFileSync(new URL('../accuracy/holdout.json',import.meta.url),'utf8'));
const excluded = [...development.cases.map(item => item.source.repository).filter(Boolean), ...previous.projects.map(item => item.repository)];
const { detectRegisteredTechnologies } = load('src/lib/analyzer/technology-registry.ts');
const results = evaluateManifestCorpus(corpus, excluded, files => detectRegisteredTechnologies(files).map(item => item.name));
const report = { schemaVersion: 1, benchmark: corpus.name, corpusSha256: createHash('sha256').update(raw).digest('hex'), scope: corpus.scope,
  reviewStatus: 'agent-provisional', humanReviewedCases: 0, globalAccuracy: null,
  firstEvaluationEngineCommit: corpus.firstEvaluationEngineCommit, initialEvaluationNoEngineTuning: true, evaluationUse: 'provisional-pinned-regression',
  metrics: decisionMetrics(results), projects: projectMetrics(results), ecosystems: groupMetrics(results,'ecosystem'),
  accuracyClaim: accuracyClaimReadiness({ results, repositories: corpus.projects.length, coveredModules: ['technology'] }),
  failures: results.filter(row => !row.passed), results };
const baseline = new URL('./manifest-baseline.json',import.meta.url);
if (process.argv.includes('--record')) fs.writeFileSync(baseline,JSON.stringify(report,null,2)+'\n');
if (process.argv.includes('--check')) checkRegression(JSON.parse(fs.readFileSync(baseline,'utf8')),report);
console.log(JSON.stringify(report,null,2));
