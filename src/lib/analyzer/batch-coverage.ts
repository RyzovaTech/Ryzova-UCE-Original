import type { AnalysisResult, Issue, ProjectFile } from './types';
import { detectBrowserCompatibility } from './browser-compatibility';
import { detectSecurityIntelligence, summarizeSecurityFindings } from './security-intelligence';
import { BROWSER_FEATURES } from './browser-knowledge';

export interface BatchFindingLimits { security: number; browser: number }

function appendIssue(result: AnalysisResult, issue: Issue): void {
  if (!result.issues.some(existing => existing.id === issue.id)) result.issues.push(issue);
}

/** Aggregate only independent per-file observations. Cross-file rules stay in the core pass. */
export function mergeSourceBatch(result: AnalysisResult, files: ProjectFile[], limits: BatchFindingLimits): void {
  const withContent = files.filter(file => typeof file.content === 'string');
  if (!withContent.length) return;
  const security = result.stack.securityIntelligence;
  if (security) {
    const batch = detectSecurityIntelligence(withContent);
    result.summary.scanStats.rulesExecuted = (result.summary.scanStats.rulesExecuted ?? 0) + batch.rulesExecuted;
    const seen = new Set(security.findings.map(finding => finding.id));
    for (const finding of batch.findings) {
      if (seen.has(finding.id)) continue;
      seen.add(finding.id);
      if (security.findings.length < 300) {
        security.findings.push(finding);
        appendIssue(result, { id: `batch-security:${finding.id}`, title: finding.title, category: 'security', severity: finding.severity,
          description: `${finding.certainty ?? 'Review required'}: ${finding.evidence}`, reason: `Independent source check at ${finding.file}:${finding.line}; static evidence needs developer review.`,
          recommendation: finding.recommendation, affectedFile: `${finding.file}:${finding.line}` });
      }
      else limits.security++;
    }
    if (batch.findings.length >= 300) limits.security++;
    result.stack.securityIntelligence = { ...summarizeSecurityFindings(security.findings, security.filesScanned + batch.filesScanned, security.rulesExecuted + batch.rulesExecuted), truncated: Boolean(security.truncated || batch.truncated || limits.security) };
  }
  const browser = result.stack.browserCompatibility;
  if (browser) {
    const batch = detectBrowserCompatibility(withContent, [], { targets: browser.targets, source: browser.targetSource ?? 'UCE default browser baseline', usedDefaults: Boolean(browser.defaultTargetsUsed) });
    const key = (finding: typeof browser.findings[number]) => `${finding.file}:${finding.id}:${finding.affectedBrowsers.join(',')}`;
    const seen = new Set(browser.findings.map(key));
    for (const finding of batch.findings) {
      const marker = key(finding);
      if (seen.has(marker)) continue;
      seen.add(marker);
      if (browser.findings.length < 200) {
        browser.findings.push(finding);
        appendIssue(result, { id: `batch-browser:${marker}`, title: `${finding.feature} browser support needs review`, category: 'configuration', severity: 'warning',
          description: `${finding.status} for ${finding.affectedBrowsers.join(', ')} (static check).`, reason: `Feature use found at ${finding.file}:${finding.line}.`,
          recommendation: finding.recommendation, affectedFile: `${finding.file}:${finding.line}` });
      }
      else limits.browser++;
    }
    if (batch.findings.length >= 200) limits.browser++;
    const featureTargets = new Set(browser.findings.map(finding => `${finding.id}|${finding.affectedBrowsers.join(',')}`));
    browser.score = featureTargets.size === 0 ? 100 : Math.max(0, Math.round(100 - (featureTargets.size / BROWSER_FEATURES.length) * 100));
    browser.filesScanned += batch.filesScanned;
  }
}

export function finishBatchCoverage(result: AnalysisResult, progress: {
  eligibleFiles: number; nextIndex: number; textFilesEligible: number; filesWithContent: number; unreadableTextFiles: number; bytesRead: number;
}, originalFilesWithContent: number, originalContentBytes: number, limits: BatchFindingLimits): void {
  const stats = result.summary.scanStats;
  stats.eligibleFiles = progress.eligibleFiles;
  stats.filesInventoried = progress.nextIndex;
  stats.filesIgnored = Math.max(0, stats.filesFound - progress.eligibleFiles);
  stats.ignoredCategories = stats.ignoredCategories.filter(category => !category.startsWith('files beyond '));
  stats.coreFilesAnalyzed ??= stats.filesAnalyzed;
  stats.filesWithContent = originalFilesWithContent + progress.filesWithContent;
  stats.textFilesEligible = progress.textFilesEligible;
  stats.contentBytesRead = originalContentBytes + progress.bytesRead;
  stats.textFilesTooLarge = progress.unreadableTextFiles;
  stats.securityFilesChecked = result.stack.securityIntelligence?.filesScanned;
  stats.browserFilesChecked = result.stack.browserCompatibility?.filesScanned;
  stats.findingsLimited = limits.security > 0 || limits.browser > 0;
  const completeInventory = progress.nextIndex === progress.eligibleFiles;
  const extras = [
    `Core cross-file/V3 rules evaluated only ${stats.coreFilesAnalyzed.toLocaleString()} selected files; per-rule budgets may restrict these further.`,
    `${stats.filesWithContent.toLocaleString()} source-text files read in bounded batches; ${progress.unreadableTextFiles.toLocaleString()} oversized text files were not read.`,
    'Additional per-file security and browser findings appear in the Issue Center but do not change the core compatibility score.',
    limits.security || limits.browser ? `Finding display caps reached (security: ${limits.security}, browser: ${limits.browser}); further findings are not included.` : '',
    completeInventory ? '' : `Archive inventory paused at ${progress.nextIndex.toLocaleString()} / ${progress.eligibleFiles.toLocaleString()} eligible files.`,
  ].filter(Boolean).join(' ');
  stats.sampled = !completeInventory || stats.sampled; // core rule sampling remains true
  stats.truncated = true;
  stats.truncationReason = extras;
  result.notes = result.notes.filter(note => !note.startsWith('Batch coverage:'));
  result.notes.push(`Batch coverage: ${extras}`);
  const coverage = result.summary.analysisCoverage;
  if (coverage) {
    coverage.status = 'partial';
    coverage.eligibleFiles = progress.eligibleFiles;
    coverage.filesInventoried = progress.nextIndex;
    coverage.coreFilesAnalyzed = stats.coreFilesAnalyzed;
    coverage.filesWithContent = stats.filesWithContent;
    coverage.textFilesEligible = progress.textFilesEligible;
    coverage.reason = extras;
  }
  if (result.trust) {
    result.trust.limitations = result.trust.limitations.filter(item => !item.startsWith('Core cross-file/V3 rules evaluated only'));
    result.trust.limitations.push(extras);
  }
  if (result.trust) result.trust.execution = { ...result.trust.execution, worker: true, cached: false, sampled: Boolean(stats.sampled), truncated: true };
}
