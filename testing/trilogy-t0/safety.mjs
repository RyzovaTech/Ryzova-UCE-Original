/**
 * Trilogy T0 — read-only developer-safety audit of canonical UCE reports.
 * This does not infer truth labels, execute native solvers or propose fixes.
 * It must never edit, rescore or relabel the input report.
 */
import { createHash } from 'node:crypto';
import { load } from '../../scripts/trusted-module-loader.mjs';

const { describeReportReadiness } = load('src/lib/report/readiness.ts');
const hash = value => createHash('sha256').update(value).digest('hex');
const safetyLabel = item => typeof item === 'string' && item.trim().length > 0;
const knownPath = path => safetyLabel(path) && !/[\x00-\x1f\x7f]/.test(path) &&
  !path.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(path) &&
  !path.split(/[\\/]/).includes('..');

/** Deliberately excludes timestamps, random IDs and benchmark timing. */
export function canonicalProjection(report) {
  if (!report || !report.score || !Array.isArray(report.categories) ||
      !Array.isArray(report.issues) || !report.summary?.scanStats || !report.stack) {
    throw Error('T0 requires a canonical UCE report');
  }
  const s = report.summary.scanStats;
  return {
    classification: report.classification,
    score: report.score,
    categories: report.categories,
    issues: report.issues,
    analysisCoverage: report.summary.analysisCoverage ?? null,
    scanLimitations: {
      filesFound: s.filesFound, filesAnalyzed: s.filesAnalyzed, filesIgnored: s.filesIgnored,
      sampled: Boolean(s.sampled), truncated: Boolean(s.truncated),
      findingsLimited: Boolean(s.findingsLimited), ruleFailures: s.ruleFailures ?? [],
    },
    security: {
      truncated: Boolean(report.stack.securityIntelligence?.truncated),
      findings: report.stack.securityIntelligence?.findings ?? [],
    },
    symbolic: report.stack.symbolicReasoning?.decisions ?? [],
    v3: {
      findings: report.stack.v3RulePlatform?.findings ?? [],
      metrics: (report.stack.v3RulePlatform?.metrics ?? []).map(item => ({
        ruleId: item.ruleId, truncated: Boolean(item.truncated),
      })),
      sweep: report.stack.v3RulePlatform?.archiveSweep ?? null,
    },
  };
}

export function canonicalEvidenceHash(report) {
  return hash(JSON.stringify(canonicalProjection(report)));
}

export function evaluateDeveloperSafety(report, filePaths = []) {
  const before = JSON.stringify(report);
  const projection = canonicalProjection(report);
  if (!Array.isArray(filePaths) || filePaths.some(path => typeof path !== 'string')) {
    throw Error('T0 file inventory must be an array of relative paths');
  }
  const paths = new Set(filePaths.filter(knownPath));
  const readiness = describeReportReadiness(report);
  const stats = report.summary.scanStats;
  const missing = [], referenced = [];
  for (const item of report.issues) {
    const raw = typeof item.affectedFile === 'string' ? item.affectedFile : '';
    const file = raw.replace(/(?::\d+|#L\d+)$/, '');
    if (knownPath(file) && paths.has(file)) referenced.push(item.id);
    else missing.push(item.id);
  }
  const limitations = [
    'No independent human-reviewed compatibility labels are included.',
    'A source path reference is not independent verification of the claim.',
    'Static rule output, symbolic satisfiability and solver agreement are not build/runtime proof.',
    'No fixes have been generated, approved, applied or validated by this audit.',
  ];
  const flags = [
    ...(readiness.partial ? ['incomplete-coverage'] : []),
    ...(stats.ruleFailures?.length ? ['rule-execution-failure'] : []),
    ...(stats.findingsLimited ? ['findings-limited'] : []),
    ...(report.stack.v3RulePlatform?.metrics?.some(m => m.truncated) ? ['v3-budget-exceeded'] : []),
    ...(missing.length ? ['unlinked-issue-provenance'] : []),
    'no-independent-ground-truth',
    'no-runtime-verification',
  ];
  // Do NOT propagate report descriptions or project source into the T0 artifact.
  const result = {
    schemaVersion: 1, engineVersion: report.analysisVersion,
    canonicalEvidenceSha256: canonicalEvidenceHash(report),
    assessment: 'review-only-not-certified',
    projectCoverage: readiness.partial ? 'incomplete' : 'assessed-static-scope',
    displayScore: readiness.displayScore,
    rawCanonicalScore: projection.score.overall,
    scoreModified: false,
    rawIssueCount: report.issues.length,
    issueProvenance: { referenced: referenced.length, unlinked: missing.length },
    ruleExecutionFailures: stats.ruleFailures?.length ?? 0,
    unverifiedFindings: report.issues.length,
    verifiedFindingCount: 0,
    findingVerification: 'not-performed',
    origin: 'UCE',
    nativeTrilogySolver: 'not-run',
    automaticFixesAllowed: false,
    generatedFixes: 0,
    independentAccuracy: {
      status: 'not-measured-needs-independent-labels',
      humanAdjudicatedCases: 0,
      precision: null, recall: null, falsePositiveRate: null,
      falseNegativeRate: null, recommendationCorrectness: null,
      globalAccuracy: null,
    },
    flags: [...new Set(flags)],
    limitations,
  };
  if (JSON.stringify(report) !== before) throw Error('T0 must never mutate a canonical report');
  return result;
}
