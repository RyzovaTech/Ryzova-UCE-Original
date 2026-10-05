import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { decisionMetrics } from '../accuracy/metrics.mjs';
import { accuracyClaimReadiness } from './evaluation.mjs';

const root = fileURLToPath(new URL('../../',import.meta.url));
const suites = [
  ['bounded-development','scripts/audit-accuracy.mjs'],
  ['mixed-development','testing/accuracy/run.mjs'],
  ['scope-development','testing/accuracy/scope.mjs'],
  ['security-context-development','testing/security/false-positive.mjs'],
  ['configuration-correlation-development','testing/correlation/audit.mjs'],
  ['previous-pinned-manifests','testing/accuracy/holdout.mjs'],
  ['new-pinned-manifests','testing/release/manifest.mjs'],
];
let currentEvaluation;
const reports = suites.map(([id,script])=>{
  const run = spawnSync(process.execPath,[script,'--check'],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024,timeout:60_000});
  if (run.error || run.status !== 0) throw Error(`Accuracy gate ${id} failed: ${run.error?.message ?? run.stderr.slice(-2000)}`);
  const report = JSON.parse(run.stdout);
  if (id === 'new-pinned-manifests') currentEvaluation = report;
  if (!Array.isArray(report.results) || !report.results.length) throw Error('Missing measured decisions: '+id);
  const metrics = decisionMetrics(report.results);
  // Regression tolerance in a legacy gate does not waive an unresolved miss.
  const failures = report.results.filter(row=>row.expected !== row.actual);
  if (failures.length) throw Error(`Unresolved accuracy decisions in ${id}: ${failures.map(row=>row.id).join(', ')}`);
  return { id, scope:report.scope, corpusSha256:report.corpusSha256 ?? null, classification:id.includes('pinned')?'provisional-pinned-regression':'development-regression',
    independentlyReviewedDecisions:0, metrics,
    ...(report.scopeClassification ? { scopeClassification:report.scopeClassification } : {}),
    ...(report.projects ? { projects:report.projects } : {}),
    ...(report.selectedManifestMetrics ? { selectedManifestMetrics:report.selectedManifestMetrics } : {}),
    failures };
});
const report = { schemaVersion:1, program:'90–95% accuracy engineering validation', engineeringGates:'passed',
  scope:'Separate development contracts and selected pinned manifest evaluations. Metrics are not pooled or averaged into global accuracy.',
  globalAccuracy:null, humanReviewedCases:0, benchmarks:reports,
  accuracyClaim:accuracyClaimReadiness({results:currentEvaluation.results,repositories:currentEvaluation.projects.repositories,coveredModules:['technology']}),
  limitations:['Independent human adjudication pending','Full-repository and module-specific blind evaluation pending','Passing detector contracts do not establish exploitability or whole-project recall'] };
const output = process.argv.find(arg=>arg.startsWith('--output='))?.slice('--output='.length);
if (output) fs.writeFileSync(path.resolve(root,output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if (process.argv.includes('--require-claim-ready') && report.accuracyClaim.status !== 'eligible-for-benchmark-review') process.exitCode=2;
