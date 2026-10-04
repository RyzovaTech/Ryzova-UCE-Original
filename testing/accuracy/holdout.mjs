import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { checkRegression } from './metrics.mjs';
import { load } from '../../scripts/trusted-module-loader.mjs';

const { detectRegisteredTechnologies } = load('src/lib/analyzer/technology-registry.ts');
const corpusRaw = fs.readFileSync(new URL('./holdout.json', import.meta.url), 'utf8');
const corpus = JSON.parse(corpusRaw);
const development = JSON.parse(fs.readFileSync(new URL('./corpus.json', import.meta.url), 'utf8'));
const developmentRepos = new Set(development.cases.map(item => item.source.repository).filter(Boolean));
const repositories = new Set();
const ids = new Set();
const results = [];

if (corpus.schemaVersion !== 1 || !Array.isArray(corpus.projects) || !corpus.projects.length) throw Error('Invalid held-out evaluation corpus.');
for (const project of corpus.projects) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(project.repository) || !/^[a-f0-9]{40}$/.test(project.commit)) throw Error('Unpinned repository identity.');
  if (repositories.has(project.repository) || developmentRepos.has(project.repository)) throw Error(`Overlapping evaluation repository: ${project.repository}`);
  repositories.add(project.repository);
  if (!project.files?.length || !project.sourcePath || !project.files.some(file => file.path === project.sourcePath)) throw Error(`Missing source excerpt: ${project.repository}`);
  const files = project.files.map(file => {
    if (!file.path || !file.content || file.path.startsWith('/') || file.path.split('/').includes('..')) throw Error(`Invalid source excerpt: ${project.repository}`);
    return { ...file, size: Buffer.byteLength(file.content), isDirectory: false };
  });
  const detected = new Set(detectRegisteredTechnologies(files).map(item => item.name));
  for (const decision of project.decisions ?? []) {
    const id = project.repository + '/' + decision.technology;
    if (ids.has(id) || !decision.rationale || typeof decision.expected !== 'boolean') throw Error(`Invalid or duplicate decision: ${id}`);
    ids.add(id);
    const actual = detected.has(decision.technology);
    results.push({ id, repository: project.repository, ecosystem: project.ecosystem, technology: decision.technology,
      expected: decision.expected, actual, passed: decision.expected === actual });
  }
}
if (results.length < repositories.size * 2) throw Error('Evaluation needs positive and negative decisions for each repository.');
for (const repository of repositories) {
  const items = results.filter(row => row.repository === repository);
  if (!items.some(row => row.expected) || !items.some(row => !row.expected)) throw Error(`Missing positive or negative label: ${repository}`);
}

const pct = (a, b) => b ? Math.round(a / b * 10000) / 100 : null;
function interval(successes, total) {
  if (!total) return null;
  const z = 1.96; const p = successes / total; const denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const spread = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator;
  return [pct(center - spread, 1), pct(center + spread, 1)];
}
function metrics(rows) {
  const tp = rows.filter(row => row.expected && row.actual).length;
  const fp = rows.filter(row => !row.expected && row.actual).length;
  const fn = rows.filter(row => row.expected && !row.actual).length;
  const tn = rows.filter(row => !row.expected && !row.actual).length;
  const projects = [...new Set(rows.map(row => row.repository))];
  const fullyCorrectProjects = projects.filter(repository => rows.filter(row => row.repository === repository).every(row => row.passed)).length;
  return { decisions: rows.length, repositories: projects.length, fullyCorrectProjects, tp, fp, fn, tn,
    decisionAccuracy: pct(tp + tn, rows.length), projectPassRate: pct(fullyCorrectProjects, projects.length),
    projectPassWilson95: interval(fullyCorrectProjects, projects.length),
    precision: pct(tp, tp + fp), recall: pct(tp, tp + fn), falsePositiveRate: pct(fp, fp + tn) };
}

const report = {
  schemaVersion: 1, benchmark: corpus.name, corpusSha256: createHash('sha256').update(corpusRaw).digest('hex'),
  scope: corpus.scope, reviewStatus: 'agent-provisional', humanReviewedCases: 0, globalAccuracy: null,
  selectedManifestMetrics: metrics(results),
  ecosystems: Object.fromEntries([...new Set(results.map(row => row.ecosystem))].map(name => [name, metrics(results.filter(row => row.ecosystem === name))])),
  failures: results.filter(row => !row.passed), results,
};
const baselineUrl = new URL('./holdout-baseline.json', import.meta.url);
if (process.argv.includes('--record')) fs.writeFileSync(baselineUrl, JSON.stringify(report, null, 2) + '\n');
if (process.argv.includes('--check')) {
  const baseline = JSON.parse(fs.readFileSync(baselineUrl, 'utf8'));
  checkRegression(baseline, report);
}
console.log(JSON.stringify(report, null, 2));
