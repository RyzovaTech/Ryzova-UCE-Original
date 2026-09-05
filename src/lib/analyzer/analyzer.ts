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
import { detectTechnologyProfiles } from './technology-profiles';
import { detectTechnologyIntelligence } from './intelligence';
import { classifyProject, NON_SOFTWARE_MESSAGE } from './classifier';
import { runAnalysis } from '../compatibility/analysis/engine';
import { computeScore } from '../compatibility/scoring';
import { buildRecommendations } from '../compatibility/recommendations';
import { CATEGORIES } from '../compatibility/categories';

const ANALYSIS_VERSION = 'uce-1.3.0';

function generateId(): string { return `rpt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

function buildTimeline(): TimelineStep[] {
  return [
    { step: 1, label: 'Project uploaded', description: 'Project archive received and validated.', status: 'done' },
    { step: 2, label: 'Files scanned', description: 'File tree extracted and known config files identified.', status: 'done' },
    { step: 3, label: 'Project classified', description: 'Project type determined from file structure and extensions.', status: 'done' },
    { step: 4, label: 'Technology detected', description: 'Languages, frameworks, runtime, and tooling inferred from project evidence.', status: 'done' },
    { step: 5, label: 'Intelligence built', description: 'Technology evidence, dependency health, and architecture patterns correlated.', status: 'done' },
    { step: 6, label: 'Rules executed', description: 'Deterministic compatibility rules evaluated per category.', status: 'done' },
    { step: 7, label: 'Report generated', description: 'Scores, issues, and recommendations assembled.', status: 'done' },
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
const MIXED_LANGUAGE_MIN_PERCENT = 1;
const MIXED_LANGUAGE_MIN_FILES = 2;

function enrichLanguageStack(stack: TechnologyStack, profiles: LanguageProfile[]): TechnologyStack {
  if (profiles.length === 0) return { ...stack, languages: [] };
  const meaningful = profiles.filter((profile, index) => index === 0 || profile.percentage >= MIXED_LANGUAGE_MIN_PERCENT || profile.files >= MIXED_LANGUAGE_MIN_FILES);
  const primary = meaningful[0] ?? profiles[0];
  const secondary = meaningful.slice(1);
  return { ...stack, languages: profiles, mixedLanguage: secondary.length > 0, primaryLanguage: primary.language, secondaryLanguages: secondary, language: primary.language };
}

export function analyzeProject(input: AnalysisInput): AnalysisResult {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const detectedFiles = parseFiles(input.files);
  const classification = classifyProject(input.files, detectedFiles);
  const detectedLanguages = detectLanguageProfile(input.files);
  const baseStack = detectStack(input.files, detectedFiles);
  const stack = enrichLanguageStack(baseStack, detectedLanguages);
  const technologyProfiles = detectTechnologyProfiles(input.files, detectedFiles, stack);
  stack.frameworks = technologyProfiles.frameworks;
  stack.runtimes = technologyProfiles.runtimes;
  const intelligence = detectTechnologyIntelligence(input.files, detectedFiles, stack);
  stack.technologyEvidence = intelligence.evidence;
  stack.dependencyIntelligence = intelligence.dependencies;
  stack.architecture = intelligence.architecture;
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
  if (stack.frameworks && stack.frameworks.length > 1) notes.push(`Multiple frameworks detected: ${stack.frameworks.join(', ')}.`);
  if (stack.runtimes && stack.runtimes.length > 1) notes.push(`Multiple runtimes detected: ${stack.runtimes.join(', ')}.`);
  if (stack.architecture) notes.push(`Architecture: ${stack.architecture.primary} (${Math.round(stack.architecture.confidence)}% confidence).`);
  if (stack.dependencyIntelligence && stack.dependencyIntelligence.total > 0) notes.push(`Dependency intelligence: ${stack.dependencyIntelligence.total} direct manifest entries; health ${stack.dependencyIntelligence.healthScore}%.`);
  return {
    id: generateId(), createdAt: new Date().toISOString(), analysisVersion: ANALYSIS_VERSION, classification, summary,
    stack, detectedFiles, categories, issues, score, timeline: buildTimeline(),
    notes: recommendations.length > 1 ? [...notes, ...recommendations.slice(1)] : notes, source: input.source,
  };
}

export type { ProjectFile };
