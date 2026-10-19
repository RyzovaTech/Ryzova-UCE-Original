#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const folder = path.resolve(process.argv[2] ?? 'benchmark-output');
const output = path.resolve(process.argv[3] ?? 'benchmark-output/RESULTS-1000.md');
const filenames = fs.readdirSync(folder).filter(x => /^shard-\d+\.json$/.test(x)).sort((a,b) => Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));
const shards = filenames.map(name => JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8')));
const expectedShards = Number(process.env.UCE_BENCHMARK_SHARDS ?? '20');
if (shards.length !== expectedShards) throw Error('Expected ' + expectedShards + ' shard files; got ' + shards.length);
const cases = shards.flatMap(x => x.results ?? []);
const unique = new Set(cases.map(c => c.repo.toLowerCase()));
if (unique.size !== cases.length || cases.length !== 1000) throw Error('Missing, duplicated or incomplete project observations: ' + cases.length + ' rows, ' + unique.size + ' unique');
function count(key, source = cases) {
  const rows = source.filter(c => c.status === 'scanned' && c[key] !== null);
  const success = rows.filter(c => c[key].agreement).length;
  return { compared: rows.length, agreed: success, disagreed: rows.length - success,
    agreementPercent: rows.length ? Math.round(success / rows.length * 10000) / 100 : null };
}
const successes = cases.filter(c => c.status === 'scanned');
const mismatches = cases.filter(c => ['language','manager','framework'].some(k => c[k] && !c[k].agreement));
const failures = cases.filter(c => c.status !== 'scanned');
const groups = [...new Set(cases.map(c => c.searchCategory))].sort();
const byGroup = Object.fromEntries(groups.map(group => [group, {
  scanned: cases.filter(c => c.searchCategory === group && c.status === 'scanned').length,
  language: count('language', cases.filter(c => c.searchCategory === group)),
}]));
const summary = {
  selected: cases.length, analyzed: successes.length, failures: failures.length,
  completeCoverage: successes.filter(c => !c.limitedCoverage).length,
  partialCoverage: successes.filter(c => c.limitedCoverage).length,
  nonSoftware: successes.filter(c => !['Software Project','Game Project'].includes(c.classification)).length,
  language: count('language'), packageManager: count('manager'), framework: count('framework'),
  mismatchedRepositories: mismatches.length, byGroup,
  note: 'Agreement with GitHub Linguist and explicit root markers. NOT externally adjudicated true accuracy or security/compatibility precision and recall.'
};
const lines = [
'# UCE V3 — 1,000 new real GitHub repositories',
'', '**OBSERVATIONAL AGREEMENT — NOT A GLOBAL ACCURACY CLAIM**', '',
'| Measure | Result |', '|---|---:|',
'| Selected repositories | ' + summary.selected + ' |',
'| Successful full-tree attempts | ' + summary.analyzed + ' |',
'| Clone or scanner failures | ' + summary.failures + ' |',
'| Complete coverage recorded | ' + summary.completeCoverage + ' |',
'| Partial/budget-limited coverage recorded | ' + summary.partialCoverage + ' |',
'| Nonsoftware projects reported | ' + summary.nonSoftware + ' |',
'| GitHub primary-language agreement | ' + summary.language.agreed + '/' + summary.language.compared + ' (' + summary.language.agreementPercent + '%) |',
'| Explicit package-manager marker agreement | ' + summary.packageManager.agreed + '/' + summary.packageManager.compared + ' (' + summary.packageManager.agreementPercent + '%) |',
'| Explicit framework marker agreement | ' + summary.framework.agreed + '/' + summary.framework.compared + ' (' + summary.framework.agreementPercent + '%) |',
'', '## By original discovery cohort', '', '| Cohort | Scanned | Language agreement |', '|---|---:|---:|',
...Object.entries(byGroup).map(([key,group]) => '| ' + key + ' | ' + group.scanned + ' | ' + group.language.agreed + '/' + group.language.compared + ' |'),
'', '## Review queue: observed disagreements (NOT automatically bugs)', '',
...mismatches.slice(0, 150).map(r => '- **' + r.repo + '** at `' + (r.sourceCommit ?? '?') + '`: ' +
 ['language','manager','framework'].filter(k => r[k] && !r[k].agreement).map(k=>k + ' expected marker/metadata `' + r[k].expected + '`, UCE `' + r[k].actual + '`').join('; ') + (r.limitedCoverage ? ' (partial coverage)' : '')),
'', '## Clone / scan failures', '',
...(failures.length ? failures.map(r => '- ' + r.repo + ': ' + r.error) : ['None']),
'', '## Limitations', '',
'- GitHub language and root markers are weak, sometimes wrong proxies and NOT independent human ground truth.',
'- Sampling via GitHub popularity, size, search query and language is biased, not randomly representative.',
'- Polyglot projects, documentation-only repositories and configuration-heavy repos need manual adjudication.',
'- Security findings, 10,000 rule alerts, false-positive rates and actual compatibility were NOT adjudicated.',
'- Retain per-repo pinned SHAs and detailed per-shard JSON as evidence; do not modify labels to improve the score.',
];
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, lines.join('\n') + '\n');
fs.writeFileSync(output.replace(/\.md$/, '.json'), JSON.stringify({summary, results: cases}, null, 2) + '\n');
console.log('UCE_1000_SUMMARY=' + JSON.stringify(summary));
console.log('UCE_1000_REVIEW_QUEUE=' + JSON.stringify(mismatches.slice(0,25).map(x => ({repo:x.repo, commit:x.sourceCommit, lang:x.language, manager:x.manager, framework:x.framework}))));
if (successes.length < 950) { console.error('Too few successful scans'); process.exitCode = 2; }
