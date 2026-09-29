import { analyzeProject } from './analyzer';
import { mergeSourceBatch, finishBatchCoverage, type BatchFindingLimits } from './batch-coverage';
import { openArchiveCheckpoint } from './archive-checkpoint';
import { scanZipBatches, type ZipBatchProgress } from './zip';
import type { AnalysisInput, AnalysisResult, LanguageProfile } from './types';
import { detectLanguageProfile } from './language-profile';

const SUPPORTING_LANGUAGES = new Set(['JSON', 'YAML', 'TOML', 'XML', 'CSS', 'SCSS', 'Sass', 'Less', 'Stylus']);

function updateLanguages(result: AnalysisResult, totals: Map<LanguageProfile['language'], { bytes: number; files: number }>): LanguageProfile[] {
  const bytes = [...totals.values()].reduce((sum, value) => sum + value.bytes, 0);
  const profiles = [...totals].map(([language, value]) => ({ language, ...value, percentage: bytes ? Math.round(value.bytes / bytes * 1000) / 10 : 0 })).sort((a, b) => b.bytes - a.bytes);
  if (!profiles.length) return profiles;
  const meaningful = profiles.filter((item, index) => index === 0 || item.percentage >= 1 || item.files >= 2);
  const primary = meaningful.find(item => !SUPPORTING_LANGUAGES.has(item.language)) ?? meaningful[0];
  result.stack.languages = profiles;
  result.stack.primaryLanguage = primary.language;
  result.stack.secondaryLanguages = meaningful.filter(item => item !== primary);
  result.stack.mixedLanguage = result.stack.secondaryLanguages.length > 0;
  result.stack.language = primary.language;
  result.summary.language = primary.language;
  return profiles;
}

/** Run the regular cross-file pass, then bounded source-level passes over the entire eligible ZIP. */
export async function analyzeArchiveBatches(file: File, baseline: AnalysisInput, onProgress: (checked: number, eligible: number, resumeAvailable: boolean) => void): Promise<AnalysisResult> {
  const started = performance.now();
  const store = await openArchiveCheckpoint(file);
  const snapshot = await store?.load();
  if (snapshot && snapshot.indexSignature !== baseline.scanStats.archiveIndexSignature) throw new Error('Archive checkpoint does not match the selected source index. Remove the old checkpoint and scan again.');
  const originalContentPaths = snapshot?.originalContentPaths ?? baseline.files.filter(item => !item.isDirectory && item.content !== undefined).map(item => item.path);
  const originalFilesWithContent = originalContentPaths.length;
  const originalContentBytes = snapshot?.originalContentBytes ?? baseline.scanStats.contentBytesRead ?? 0;
  const result = snapshot?.result ?? analyzeProject(baseline);
  const limits: BatchFindingLimits = { security: snapshot?.securityFindingsOmitted ?? 0, browser: snapshot?.browserFindingsOmitted ?? 0 };
  const languageTotals = new Map<LanguageProfile['language'], { bytes: number; files: number }>((snapshot?.languages ?? []).map(item => [item.language, { bytes: item.bytes, files: item.files }]));
  const previouslyRead = { filesWithContent: snapshot?.additionalFilesWithContent ?? 0, bytesRead: snapshot?.additionalBytesRead ?? 0, unreadableTextFiles: snapshot?.unreadableTextFiles ?? 0 };
  const startIndex = snapshot?.nextIndex ?? 0;
  let lastSaved = startIndex;
  let persistenceAvailable = Boolean(store);
  const cumulative = (progress: ZipBatchProgress): ZipBatchProgress => ({
    ...progress,
    filesWithContent: previouslyRead.filesWithContent + progress.filesWithContent,
    unreadableTextFiles: previouslyRead.unreadableTextFiles + progress.unreadableTextFiles,
    bytesRead: previouslyRead.bytesRead + progress.bytesRead,
  });
  const previousElapsed = snapshot?.result.summary.scanStats.scanTimeMs ?? 0;
  const update = (progress: ZipBatchProgress) => {
    finishBatchCoverage(result, progress, originalFilesWithContent, originalContentBytes, limits);
    result.summary.scanStats.scanTimeMs = Math.round(previousElapsed + performance.now() - started);
  };
  const next = await scanZipBatches(file, new Set(originalContentPaths), async (batch, progress) => {
    if (snapshot && (progress.eligibleFiles !== snapshot.eligibleFiles || progress.indexSignature !== snapshot.indexSignature)) throw new Error('Archive checkpoint does not match its ZIP index. Start a new scan.');
    mergeSourceBatch(result, batch, limits);
    for (const language of detectLanguageProfile(batch)) {
      const total = languageTotals.get(language.language) ?? { bytes: 0, files: 0 };
      total.bytes += language.bytes; total.files += language.files;
      languageTotals.set(language.language, total);
    }
    const languages = updateLanguages(result, languageTotals);
    const state = cumulative(progress);
    update(state);
    if (store && persistenceAvailable && (progress.nextIndex - lastSaved >= 1024 || progress.nextIndex === progress.eligibleFiles)) {
      try { await store.save({
        version: 1, nextIndex: progress.nextIndex, eligibleFiles: progress.eligibleFiles, indexSignature: progress.indexSignature,
        originalContentPaths, originalContentBytes,
        additionalFilesWithContent: state.filesWithContent, additionalBytesRead: state.bytesRead,
        unreadableTextFiles: state.unreadableTextFiles,
        additionalSecurityFiles: result.stack.securityIntelligence?.filesScanned ?? 0,
        additionalBrowserFiles: result.stack.browserCompatibility?.filesScanned ?? 0,
        securityFindingsOmitted: limits.security, browserFindingsOmitted: limits.browser, languages, result,
      }); lastSaved = progress.nextIndex; }
      catch { persistenceAvailable = false; } // Quota exhaustion disables persistence without aborting analysis.
    }
    onProgress(progress.nextIndex, progress.eligibleFiles, persistenceAvailable && lastSaved > 0);
  }, undefined, startIndex);
  if (snapshot && (next.eligibleFiles !== snapshot.eligibleFiles || next.indexSignature !== snapshot.indexSignature)) throw new Error('Archive checkpoint does not match its ZIP index. Start a new scan.');
  update(cumulative(next));
  onProgress(next.nextIndex, next.eligibleFiles, persistenceAvailable && lastSaved > 0);
  await store?.clear();
  return result;
}
