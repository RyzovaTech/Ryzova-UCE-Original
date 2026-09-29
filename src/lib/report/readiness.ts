import type { AnalysisResult } from '../analyzer/types';

/** A compatibility score describes observed evidence, not the unscanned project. */
export function describeReportReadiness(report: AnalysisResult): { title: string; scope: string; coverage: string | null; partial: boolean; displayScore: number | null } {
  const coverage = report.summary.analysisCoverage;
  const partial = coverage?.status === 'partial' || Boolean(report.summary.scanStats.truncated || report.summary.scanStats.sampled || report.stack.securityIntelligence?.truncated) || Boolean(report.stack.v3RulePlatform?.metrics.some(metric => metric.truncated));
  if (partial) {
    const selected = report.summary.scanStats.filesAnalyzed;
    const discovered = report.summary.scanStats.filesFound;
    return {
      title: 'Partial scan — review coverage',
      scope: 'not established',
      coverage: [
        `${selected.toLocaleString()} of ${discovered.toLocaleString()} discovered files entered core analysis${coverage ? ` (${coverage.fileCoveragePercent}%)` : ''}.`,
        report.summary.scanStats.filesInventoried !== undefined ? `${report.summary.scanStats.filesInventoried.toLocaleString()} of ${report.summary.scanStats.eligibleFiles?.toLocaleString() ?? 'unknown'} eligible paths inventoried.` : '',
        report.summary.scanStats.filesWithContent !== undefined ? `Text read from ${report.summary.scanStats.filesWithContent.toLocaleString()} files across all passes; reading content does not mean every rule evaluated it.` : 'Some selected files may have metadata only.',
        report.summary.scanStats.securityFilesChecked !== undefined ? `Security module: ${report.summary.scanStats.securityFilesChecked.toLocaleString()} source files checked.` : '',
        report.summary.scanStats.browserFilesChecked !== undefined ? `Browser module: ${report.summary.scanStats.browserFilesChecked.toLocaleString()} source files checked.` : '',
        report.stack.v3RulePlatform?.metrics.some(metric => metric.truncated) ? 'Some rules reached their evaluation budgets.' : '',
        report.stack.v3RulePlatform?.archiveSweep ? `${report.stack.v3RulePlatform.archiveSweep.rulesChecked.toLocaleString()} standalone V3 source/dependency rules checked ${report.stack.v3RulePlatform.archiveSweep.filesChecked.toLocaleString()} readable files; multi-detector and cross-file rules remain core-limited.` : '',
        'Overall readiness is not established. Findings do not cover unchecked content.',
      ].filter(Boolean).join(' '),
      displayScore: null,
      partial: true,
    };
  }
  const critical = report.issues.some((item) => item.severity === 'critical');
  const score = report.score.overall;
  const title = critical ? 'Important issues need review' : score >= 90 ? 'No major issues detected by static checks' : score >= 75 ? 'Mostly ready; review a few areas' : score >= 50 ? 'Usable, but needs focused improvements' : 'Significant review is recommended';
  return { title, scope: 'static checks', coverage: null, partial: false, displayScore: score };
}

/** Exclude explicitly inapplicable and unknown categories from remediation ranking. */
export function attentionCategories(report: AnalysisResult) {
  return report.categories.filter(item => item.status !== 'unknown' &&
    (!report.score.applicableCategories || report.score.applicableCategories.includes(item.id)) && item.score < 80)
    .sort((a, b) => a.score - b.score);
}

export function reportCoverageRows(report: AnalysisResult): Array<{ label: string; checked: number | null; note: string }> {
  const stats = report.summary.scanStats;
  return [
    { label: 'Archive inventory', checked: stats.filesInventoried ?? null, note: stats.eligibleFiles === undefined ? 'Eligible total not recorded' : `${stats.eligibleFiles.toLocaleString()} eligible paths; inventory is not rule execution` },
    { label: 'Text read', checked: stats.filesWithContent ?? null, note: `${stats.textFilesTooLarge ?? 0} oversized files recorded; content reading is not semantic analysis` },
    { label: 'Core analysis input', checked: stats.coreFilesAnalyzed ?? stats.filesAnalyzed, note: 'Selected files; individual rules may check fewer' },
    { label: 'Security', checked: report.stack.securityIntelligence?.filesScanned ?? null, note: 'Source files visited; rule scope and finding limits still apply' },
    { label: 'Browser', checked: report.stack.browserCompatibility?.filesScanned ?? null, note: 'Browser source files visited; zero means no browser files checked' },
    { label: 'Code', checked: report.stack.codeIntelligence?.filesAnalyzed ?? null, note: 'Core code module input; parser coverage varies by language' },
    { label: 'V3 per-file sweep', checked: report.stack.v3RulePlatform?.archiveSweep?.filesChecked ?? null, note: report.stack.v3RulePlatform?.archiveSweep ? `${report.stack.v3RulePlatform.archiveSweep.rulesChecked.toLocaleString()} standalone rules, ${report.stack.v3RulePlatform.archiveSweep.dependencyFilesChecked.toLocaleString()} dependency manifests, ${report.stack.v3RulePlatform.archiveSweep.ruleFileVisits.toLocaleString()} rule-file visits; ${report.stack.v3RulePlatform.archiveSweep.findingsOmitted.toLocaleString()} findings omitted by display caps` : 'No archive source sweep recorded' },
    ...Object.values(report.stack.extendedIntelligence?.modules ?? {}).map(module => ({ label: module.label, checked: null, note: 'Module-specific file coverage not recorded; core input limits apply' })),
  ];
}
