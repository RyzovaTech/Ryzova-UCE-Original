import { decisionMetrics, percent, wilson95 } from '../accuracy/metrics.mjs';

const safePath = path => typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('\\') && !path.includes(':') && !path.split('/').some(part => !part || part === '..' || part === '.');
export function evaluateManifestCorpus(corpus, excludedRepositories, detect) {
  if (corpus.schemaVersion !== 1 || corpus.labelStatus !== 'agent-provisional' || !Array.isArray(corpus.projects) || !corpus.projects.length) throw Error('Invalid provisional evaluation collection');
  const repositories = new Set(), ids = new Set(), results = [];
  const excluded = new Set([...excludedRepositories].map(repo => repo.toLowerCase()));
  for (const project of corpus.projects) {
    const repository = project.repository;
    if (typeof repository !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[a-f0-9]{40}$/.test(project.commit)) throw Error('Unpinned repository identity');
    const canonical = repository.toLowerCase();
    if (repositories.has(canonical) || excluded.has(canonical)) throw Error('Repository overlap: ' + repository);
    repositories.add(canonical);
    if (!safePath(project.sourcePath) || !/^[a-f0-9]{64}$/.test(project.sourceSha256) || project.sourceUrl !== `https://github.com/${repository}/blob/${project.commit}/${project.sourcePath}` || !project.upstreamLicense || !['selected-manifest-fields','leading-sections','full-file'].includes(project.excerptKind) || !project.ecosystem) throw Error('Invalid source provenance');
    if (!Array.isArray(project.files) || !project.files.length || !project.files.some(file => file.path === project.sourcePath)) throw Error('Missing source excerpt');
    const paths = new Set();
    const files = project.files.map(file => {
      if (!safePath(file.path) || paths.has(file.path) || typeof file.content !== 'string' || !file.content.trim()) throw Error('Invalid source excerpt');
      paths.add(file.path);
      return { ...file, size: Buffer.byteLength(file.content), isDirectory: false };
    });
    if (!Array.isArray(project.decisions) || !project.decisions.some(item => item.expected === true) || !project.decisions.some(item => item.expected === false)) throw Error('Every project needs positive and negative labels');
    for (const decision of project.decisions) {
      const id = repository + '/' + decision.technology;
      if (typeof decision.technology !== 'string' || !decision.technology.trim() || !decision.rationale || typeof decision.expected !== 'boolean' || ids.has(id)) throw Error('Invalid decision: ' + id);
      ids.add(id);
    }
    // Validate all labels before asking the detector for this project's result.
    const technologies = new Set(detect(files));
    for (const decision of project.decisions) {
      const actual = technologies.has(decision.technology);
      results.push({ id: repository + '/' + decision.technology, repository, ecosystem: project.ecosystem, technology: decision.technology, expected: decision.expected, actual, passed: decision.expected === actual });
    }
  }
  return results;
}
export function projectMetrics(rows) {
  const repositories = [...new Set(rows.map(row => row.repository))];
  const passing = repositories.filter(repo => rows.filter(row => row.repository === repo).every(row => row.expected === row.actual)).length;
  return { repositories: repositories.length, fullyCorrectProjects: passing, projectPassRate: percent(passing,repositories.length), projectPassWilson95: wilson95(passing,repositories.length) };
}
/** Fail closed: CI contract success cannot authorize a broad accuracy claim. */
export function accuracyClaimReadiness(evidence) {
  const blockers = [];
  const { results = [], repositories = 0, independentlyReviewedDecisionIds = [], independentReviewVerified = false, blindEvaluation = false, fullRepositoryBoundariesVerified = false, coveredModules = [] } = evidence;
  const metrics = decisionMetrics(results);
  const reviewed = new Set(Array.isArray(independentlyReviewedDecisionIds) ? independentlyReviewedDecisionIds : []);
  const allReviewed = results.length > 0 && results.every(row => reviewed.has(row.id)) && reviewed.size === results.length;
  if (independentReviewVerified !== true || !allReviewed) blockers.push('Independent decision adjudication is incomplete or unverified');
  if (blindEvaluation !== true) blockers.push('A fresh independent blind evaluation is required');
  if (fullRepositoryBoundariesVerified !== true) blockers.push('Full-repository scan boundaries have not been verified');
  if (!Number.isInteger(repositories) || repositories < 30) blockers.push('At least 30 independently selected repositories are required');
  if (metrics.tp + metrics.fn < 50 || metrics.tn + metrics.fp < 50) blockers.push('At least 50 positive and 50 negative decisions are required');
  if (metrics.precision === null || metrics.precision < 95 || metrics.recall === null || metrics.recall < 90) blockers.push('Supported-benchmark targets require precision >=95% and recall >=90%');
  if (!Array.isArray(coveredModules) || !coveredModules.includes('technology') || !coveredModules.includes('security') || !coveredModules.includes('compatibility')) blockers.push('Technology, security and compatibility need independent module evaluations');
  return { status: blockers.length ? 'not-established' : 'eligible-for-benchmark-review', globalAccuracy: null,
    targets: { precision: 95, recall: 90 }, policy: { minimumRepositories: 30, minimumPositiveDecisions: 50, minimumNegativeDecisions: 50 }, blockers,
    automaticGlobalClaim: false };
}
