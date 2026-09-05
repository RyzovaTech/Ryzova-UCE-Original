import type {
  AnalysisInput,
  AnalysisResult,
  ProjectFile,
  TimelineStep,
  CompatibilityScore,
  CategoryResult,
  Issue,
  TechnologyStack,
  LanguageProfile,
} from './types';
import { parseFiles } from './parser';
import { detectStack, buildSummary } from './detectors';
import { detectLanguageProfile } from './language-profile';
import { classifyProject, NON_SOFTWARE_MESSAGE } from './classifier';
import { runAnalysis } from '../compatibility/analysis/engine';
import { computeScore } from '../compatibility/scoring';
import { buildRecommendations } from '../compatibility/recommendations';
import { CATEGORIES } from '../compatibility/categories';

const ANALYSIS_VERSION = 'uce-1.2.3';

function generateId(): string { return `rpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

function buildTimeline(): TimelineStep[] {
  return [
    { step: 1, label: 'Project uploaded', description: 'Project archive received and validated.', status: 'done' },
    { step: 2, label: 'Files scanned', description: 'File tree extracted and known config files identified.', status: 'done' },
    { step: 3, label: 'Project classified', description: 'Project type determined from file structure and extensions.', status: 'done' },
    { step: 4, label: 'Technology detected', description: 'Languages, frameworks, runtime, and tooling inferred from project evidence.', status: 'done' },
    { step: 5, label: 'Rules executed', description: 'Deterministic compatibility rules evaluated per category.', status: 'done' },
    { step: 6, label: 'Report generated', description: 'Scores, issues, and recommendations assembled.', status: 'done' },
  ];
}

function buildNonSoftwareTimeline(): TimelineStep[] {
  return [
    { step: 1, label: 'Project uploaded', description: 'Project archive received and validated.', status: 'done' },
    { step: 2, label: 'Files scanned', description: 'File tree extracted and known config files identified.', status: 'done' },
    { step: 3, label: 'Project classified', description: 'Project type determined from file structure and extensions.', status: 'done' },
    { step: 4, label: 'Analysis skipped', description: 'Compatibility analysis not applicable to this project type.', status: 'done' },
    { step: 5, label: 'Report generated', description: 'Classification report assembled.', status: 'done' },
  ];
}

function buildNonSoftwareCategories(): CategoryResult[] {
  return CATEGORIES.map((cat) => ({ id: cat.id, label: cat.label, status: 'unknown' as const, score: 0, issues: [] as Issue[], summary: 'Not applicable — project is not a software engineering project.' }));
}

const ZERO_SCORE: CompatibilityScore = { runtime: 0, dependencies: 0, configuration: 0, structure: 0, environment: 0, security: 0, deployment: 0, performance: 0, overall: 0 };

// A language is considered meaningful when it has at least 1% of source bytes,
// or when it has at least two source files. This prevents a single tiny helper
// file from making a normal project look mixed while still recognizing genuine
// polyglot projects with small integration layers.
const MIXED_LANGUAGE_MIN_PERCENT = 1;
const MIXED_LANGUAGE_MIN_FILES = 2;

function enrichLanguageStack(stack: TechnologyStack, profiles: LanguageProfile[]): TechnologyStack {
  if (profiles.length === 0) return { ...stack, languages: [] };

  const meaningful = profiles.filter((profile, index) =>
    index === 0 || profile.percentage >= MIXED_LANGUAGE_MIN_PERCENT || profile.files >= MIXED_LANGUAGE_MIN_FILES
  );
  const primary = meaningful[0] ?? profiles[0];
  const secondary = meaningful.slice(1);

  return {
    ...stack,
    languages: profiles,
    mixedLanguage: secondary.length > 0,
    primaryLanguage: primary.language,
    secondaryLanguages: secondary,
    // Keep the legacy `language` field stable: it represents the primary language.
    language: primary.language,
  };
}

export function analyzeProject(input: AnalysisInput): AnalysisResult {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const detectedFiles = parseFiles(input.files);
  const classification = classifyProject(input.files, detectedFiles);
  const detectedLanguages = detectLanguageProfile(input.files);
  const stack = enrichLanguageStack(detectStack(input.files, detectedFiles), detectedLanguages);
  const summary = buildSummary(input.fileName, input.files, detectedFiles, stack, input.scanStats);

  if (!classification.isSoftware) {
    return {
      id: generateId(), createdAt: new Date().toISOString(), analysisVersion: ANALYSIS_VERSION,
      classification, summary, stack, detectedFiles, categories: buildNonSoftwareCategories(), issues: [], score: ZERO_SCORE,
      timeline: buildNonSoftwareTimeline(),
      notes: [`Analysis completed by UCE Engine v${ANALYSIS_VERSION}.`, 'Results are generated using deterministic classification rules — no AI or external calls.', NON_SOFTWARE_MESSAGE],
      source: input.source,
    };
  }

  const ctx = { files: input.files, detectedFiles, stack, projectName: input.fileName };
  const categories = runAnalysis(ctx);
  const score = computeScore(categories);
  const issues = categories.flatMap((c) => c.issues);
  const recommendations = buildRecommendations(categories);
  const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const scanTimeMs = Math.round(endTime - startTime);
  const memoryUsedMB = typeof performance !== 'undefined' && (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    ? Math.round((performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1024 / 1024 * 10) / 10 : undefined;
  const rulesExecuted = categories.reduce((sum, c) => sum + c.issues.length, 0);
  if (summary.scanStats) {
    summary.scanStats.scanTimeMs = scanTimeMs;
    if (memoryUsedMB !== undefined) summary.scanStats.memoryUsedMB = memoryUsedMB;
    summary.scanStats.rulesExecuted = rulesExecuted;
  }
  const notes: string[] = [`Analysis completed by UCE Engine v${ANALYSIS_VERSION}.`, 'Results are generated using deterministic compatibility rules — no AI or external calls.', recommendations[0]];
  if (stack.mixedLanguage && stack.secondaryLanguages?.length) {
    const breakdown = stack.secondaryLanguages.map((p) => `${p.language} ${p.percentage}%`).join(', ');
    notes.push(`Mixed-language project detected: primary ${stack.primaryLanguage ?? stack.language}; secondary ${breakdown}.`);
  }
  return {
    id: generateId(), createdAt: new Date().toISOString(), analysisVersion: ANALYSIS_VERSION, classification, summary,
    stack, detectedFiles, categories, issues, score, timeline: buildTimeline(),
    notes: recommendations.length > 1 ? [...notes, ...recommendations.slice(1)] : notes, source: input.source,
  };
}

export type { ProjectFile };
