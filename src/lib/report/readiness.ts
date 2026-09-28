import type { AnalysisResult } from '../analyzer/types';

/** A compatibility score describes observed evidence, not the unscanned project. */
export function describeReportReadiness(report: AnalysisResult): { title: string; scope: string; coverage: string | null; partial: boolean } {
  const coverage = report.summary.analysisCoverage;
  const partial = coverage?.status === 'partial' || Boolean(report.summary.scanStats.truncated);
  if (partial) {
    const selected = report.summary.scanStats.filesAnalyzed;
    const discovered = report.summary.scanStats.filesFound;
    return {
      title: 'Partial scan — review coverage',
      scope: 'checked scope',
      coverage: `${selected.toLocaleString()} of ${discovered.toLocaleString()} discovered files entered the analysis set${coverage ? ` (${coverage.fileCoveragePercent}%)` : ''}.${coverage?.filesWithContent !== undefined ? ` Text content checked for ${coverage.filesWithContent.toLocaleString()} selected files.` : ' Some selected files may have metadata only.'}${report.stack.v3RulePlatform?.metrics.some((metric) => metric.truncated) ? ' Some rules reached their evaluation budgets.' : ''} Findings and score do not cover unchecked content.`,
      partial: true,
    };
  }
  const critical = report.issues.some((item) => item.severity === 'critical');
  const score = report.score.overall;
  const title = critical ? 'Important issues need review' : score >= 90 ? 'Ready with strong confidence' : score >= 75 ? 'Mostly ready; review a few areas' : score >= 50 ? 'Usable, but needs focused improvements' : 'Significant review is recommended';
  return { title, scope: 'readiness', coverage: null, partial: false };
}
