import type { CategoryId, CategoryResult, CategoryStatus, Issue, Language, ProjectFile } from '../../analyzer/types';
import type { RuleContext } from '../types';
import { ALL_RULES } from '../rules';
import { CATEGORIES } from '../categories';

const JS_TS_ONLY_RULE_IDS = new Set([
  'node-engine-pinned', 'node-version-file', 'npm-license-missing', 'tsconfig-strict-mode',
  'tsconfig-target-modern', 'eslint-config-present', 'prettier-config-present',
  'jest-or-vitest-config-present', 'package-json-type-module', 'tsconfig-module-resolution',
  'pkg-entry-point-missing', 'gitignore-covers-node-modules', 'gitignore-covers-build-output',
  'public-directory-present', 'src-directory-present', 'no-side-effects-hint', 'no-bundle-analyzer',
  'vite-no-sourcemap', 'no-prefetch-project/index.html', 'vite-config-present', 'next-config-present',
  'tailwind-config-present', 'tsconfig-present',
]);

const JS_TS_LANGUAGES: ReadonlySet<Language> = new Set(['TypeScript', 'JavaScript']);

function isApplicable(ruleId: string, language: Language): boolean {
  if (!JS_TS_ONLY_RULE_IDS.has(ruleId)) return true;
  return JS_TS_LANGUAGES.has(language);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function fileBase(path: string): string {
  return normalizePath(path).split('/').pop() ?? path;
}

function tsconfigFiles(ctx: RuleContext): ProjectFile[] {
  return ctx.files.filter((f) => {
    if (f.isDirectory) return false;
    const base = fileBase(f.path);
    return base === 'tsconfig.json' || /^tsconfig\..+\.json$/i.test(base);
  });
}

function anyTsconfigOption(ctx: RuleContext, option: string, predicate: (value: unknown) => boolean): boolean {
  for (const file of tsconfigFiles(ctx)) {
    if (!file.content) continue;
    try {
      const parsed = JSON.parse(file.content) as { compilerOptions?: Record<string, unknown> };
      if (predicate(parsed.compilerOptions?.[option])) return true;
    } catch {
      // Invalid JSON is handled by the individual rule.
    }
  }
  return false;
}

function packageJson(ctx: RuleContext): Record<string, unknown> | null {
  const file = ctx.files.find((f) => !f.isDirectory && fileBase(f.path) === 'package.json');
  if (!file?.content) return null;
  try {
    return JSON.parse(file.content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function hasEslintConfig(ctx: RuleContext): boolean {
  return ctx.files.some((f) => {
    if (f.isDirectory) return false;
    const base = fileBase(f.path);
    return base === '.eslintrc' ||
      /^\.eslintrc\.(json|js|cjs|mjs)$/i.test(base) ||
      /^eslint\.config\.(js|mjs|cjs|ts|mts|cts)$/i.test(base);
  });
}

function hasCiWorkflow(ctx: RuleContext): boolean {
  return ctx.files.some((f) => {
    if (f.isDirectory) return false;
    return /^\.github\/workflows\/[^/]+\.(yml|yaml)$/i.test(normalizePath(f.path));
  });
}

function filterEvidenceAwareFalsePositives(ruleId: string, issues: Issue[], ctx: RuleContext): Issue[] {
  if (!issues.length) return issues;

  if (ruleId === 'tsconfig-strict-mode' && anyTsconfigOption(ctx, 'strict', (v) => v === true)) {
    issues = issues.filter((issue) => issue.id !== 'tsconfig-strict-missing');
  }

  if (ruleId === 'tsconfig-module-resolution' && anyTsconfigOption(ctx, 'moduleResolution', (v) => typeof v === 'string' && v.length > 0)) {
    issues = issues.filter((issue) => issue.id !== 'tsconfig-module-resolution-missing');
  }

  if (ruleId === 'eslint-config-present' && hasEslintConfig(ctx)) {
    issues = issues.filter((issue) => issue.id !== 'eslint-config-missing');
  }

  // CI/CD is a capability. Never report it as missing when a workflow is present.
  if (hasCiWorkflow(ctx)) {
    issues = issues.filter((issue) =>
      !/ci\/cd|continuous integration|continuous delivery/i.test(issue.title) &&
      !/ci\/cd|continuous integration|continuous delivery/i.test(issue.description)
    );
  }

  // Applications do not need a publishable package entry point. Detect app-style
  // manifests before reporting a missing main/module/exports/bin field.
  if (ruleId === 'package-json-main-entry' || ruleId === 'pkg-entry-point-missing') {
    const pkg = packageJson(ctx);
    const scripts = pkg?.scripts as Record<string, unknown> | undefined;
    const appLike = pkg?.private === true ||
      (!!scripts && (typeof scripts.dev === 'string' || typeof scripts.build === 'string'));
    if (appLike) issues = issues.filter((issue) => issue.id !== 'pkg-entry-point-missing');
  }

  return issues;
}

function deduplicateIssues(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.id}|${normalizePath(issue.affectedFile)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function statusFromIssues(issues: Issue[]): CategoryStatus {
  if (issues.length === 0) return 'good';
  if (issues.some((i) => i.severity === 'critical')) return 'warning';
  if (issues.some((i) => i.severity === 'warning')) return 'warning';
  return 'good';
}

function scoreFromIssues(issues: Issue[]): number {
  // Informational advisories are guidance, not compatibility failures.
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const penalty = Math.min(criticalCount, 4) * 20 + Math.max(0, criticalCount - 4) * 5 +
    Math.min(warningCount, 5) * 10 + Math.max(0, warningCount - 5) * 3;
  return Math.max(0, Math.round(100 - penalty));
}

export function countApplicableRules(language: Language): number {
  return ALL_RULES.reduce((count, rule) => count + (isApplicable(rule.id, language) ? 1 : 0), 0);
}

export function runAnalysis(ctx: RuleContext): CategoryResult[] {
  const byCategory = new Map<CategoryId, Issue[]>();
  for (const rule of ALL_RULES) {
    if (!isApplicable(rule.id, ctx.stack.language)) continue;
    let issues: Issue[] = [];
    try {
      issues = filterEvidenceAwareFalsePositives(rule.id, rule.run(ctx) ?? [], ctx);
    } catch {
      issues = [];
    }
    if (!issues.length) continue;
    const list = byCategory.get(rule.category) ?? [];
    list.push(...issues);
    byCategory.set(rule.category, list);
  }

  return CATEGORIES.map((cat) => {
    const issues = deduplicateIssues(byCategory.get(cat.id) ?? []);
    const status = statusFromIssues(issues);
    const score = scoreFromIssues(issues);
    const summary = issues.length === 0
      ? `No compatibility issues detected in ${cat.label.toLowerCase()}.`
      : `${issues.length} issue${issues.length > 1 ? 's' : ''} detected (${issues.filter((i) => i.severity === 'critical').length} critical).`;
    return { id: cat.id, label: cat.label, status, score, issues, summary };
  });
}
