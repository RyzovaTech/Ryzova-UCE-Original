import type { CategoryId, CategoryResult, CategoryStatus, Issue, Language, ProjectFile } from '../../analyzer/types';
import type { RuleContext } from '../types';
import { ALL_RULES } from '../rules';
import { CATEGORIES } from '../categories';

// Rules that only make sense for JS/TS projects. Skip them when the detected
// language is C, C++, Rust, Go, Python, etc. — otherwise a Linux kernel
// tarball that happens to ship a tsconfig.json for its Node tooling gets
// flagged for missing eslint/prettier/vitest, which are false positives.
const JS_TS_ONLY_RULE_IDS = new Set([
  'node-engine-pinned',
  'node-version-file',
  'npm-license-missing',
  'tsconfig-strict-mode',
  'tsconfig-target-modern',
  'eslint-config-present',
  'prettier-config-present',
  'jest-or-vitest-config-present',
  'package-json-type-module',
  'tsconfig-module-resolution',
  'pkg-entry-point-missing',
  'gitignore-covers-node-modules',
  'gitignore-covers-build-output',
  'public-directory-present',
  'src-directory-present',
  'no-side-effects-hint',
  'no-bundle-analyzer',
  'vite-no-sourcemap',
  'no-prefetch-project/index.html',
  'vite-config-present',
  'next-config-present',
  'tailwind-config-present',
  'tsconfig-present',
]);

const JS_TS_LANGUAGES: ReadonlySet<Language> = new Set(['TypeScript', 'JavaScript']);

function isApplicable(ruleId: string, language: Language): boolean {
  if (!JS_TS_ONLY_RULE_IDS.has(ruleId)) return true;
  return JS_TS_LANGUAGES.has(language);
}

function fileBase(path: string): string {
  return path.replace(/^\.\//, '').split('/').pop() ?? path;
}

function projectFileContent(files: ProjectFile[], path: string): string | null {
  const match = files.find((f) => !f.isDirectory && (f.path === path || f.path.endsWith('/' + path)));
  return match?.content ?? null;
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
      // Invalid JSON is handled by the individual rule; do not let it break analysis.
    }
  }
  return false;
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

function filterEvidenceAwareFalsePositives(ruleId: string, issues: Issue[], ctx: RuleContext): Issue[] {
  if (!issues.length) return issues;

  // TypeScript project references can move compiler options out of the root
  // tsconfig.json. If ANY referenced tsconfig enables strict mode, the project
  // is strict and must not be reported as non-strict just because the root
  // config is a references-only file.
  if (ruleId === 'tsconfig-strict-mode' && anyTsconfigOption(ctx, 'strict', (v) => v === true)) {
    return issues.filter((issue) => issue.id !== 'tsconfig-strict-missing');
  }

  // Likewise, moduleResolution may legitimately live in tsconfig.app.json or
  // another referenced config rather than the root tsconfig.json.
  if (ruleId === 'tsconfig-module-resolution' && anyTsconfigOption(ctx, 'moduleResolution', (v) => typeof v === 'string' && v.length > 0)) {
    return issues.filter((issue) => issue.id !== 'tsconfig-module-resolution-missing');
  }

  // Use the complete project file tree as evidence. detectedFiles is a useful
  // index, but compatibility rules must not disagree with files already found
  // by the parser (especially ESLint flat configs).
  if (ruleId === 'eslint-config-present' && hasEslintConfig(ctx)) {
    return issues.filter((issue) => issue.id !== 'eslint-config-missing');
  }

  return issues;
}

function statusFromIssues(issues: Issue[]): CategoryStatus {
  if (issues.length === 0) return 'good';
  if (issues.some((i) => i.severity === 'critical')) return 'warning';
  if (issues.some((i) => i.severity === 'warning')) return 'warning';
  return 'good';
}

function scoreFromIssues(issues: Issue[]): number {
  let penalty = 0;
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  // Diminishing returns: first few issues penalize heavily, additional ones less so
  penalty += Math.min(criticalCount, 4) * 20 + Math.max(0, criticalCount - 4) * 5;
  penalty += Math.min(warningCount, 5) * 10 + Math.max(0, warningCount - 5) * 3;
  penalty += Math.min(infoCount, 10) * 3 + Math.max(0, infoCount - 10) * 1;

  return Math.max(0, Math.round(100 - penalty));
}

export function runAnalysis(ctx: RuleContext): CategoryResult[] {
  const byCategory = new Map<CategoryId, Issue[]>();
  for (const rule of ALL_RULES) {
    if (!isApplicable(rule.id, ctx.stack.language)) continue;
    let issues: Issue[] = [];
    try {
      issues = rule.run(ctx) ?? [];
      issues = filterEvidenceAwareFalsePositives(rule.id, issues, ctx);
    } catch {
      // A single rule failing should never crash the whole analysis.
      issues = [];
    }
    if (!issues.length) continue;
    const list = byCategory.get(rule.category) ?? [];
    list.push(...issues);
    byCategory.set(rule.category, list);
  }

  return CATEGORIES.map((cat) => {
    const issues = byCategory.get(cat.id) ?? [];
    const status = statusFromIssues(issues);
    const score = scoreFromIssues(issues);
    const summary =
      issues.length === 0
        ? `No compatibility issues detected in ${cat.label.toLowerCase()}.`
        : `${issues.length} issue${issues.length > 1 ? 's' : ''} detected (${issues.filter((i) => i.severity === 'critical').length} critical).`;
    return { id: cat.id, label: cat.label, status, score, issues, summary };
  });
}
