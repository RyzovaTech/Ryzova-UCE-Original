import type { CompatibilityRule } from '../types';
import type { Issue } from '../../analyzer/types';

function hasPath(ctx: import('../types').RuleContext, candidates: string[]): boolean {
  return ctx.files.some((f) =>
    candidates.some((c) => f.path === c || f.path.startsWith(c + '/') || f.path.endsWith('/' + c))
  );
}

const EXPECTED: Record<
  string,
  { any?: string[]; all?: string[]; severity: 'critical' | 'warning' | 'info' }
> = {
  'Next.js': { any: ['app', 'pages', 'src'], severity: 'warning' },
  'Nuxt': { any: ['pages', 'components', 'src'], severity: 'warning' },
  'React': { any: ['src', 'public', 'index.html'], severity: 'warning' },
  'Vue': { any: ['src', 'index.html'], severity: 'warning' },
  'Angular': { all: ['src', 'angular.json'], severity: 'warning' },
  'SvelteKit': { any: ['src', 'routes'], all: ['svelte.config.js'], severity: 'warning' },
  'Astro': { any: ['src', 'public'], severity: 'warning' },
  'Remix': { any: ['app', 'src'], severity: 'warning' },
  'Express': { any: ['src', 'server.js', 'index.js', 'app.js'], severity: 'info' },
  'NestJS': { all: ['src'], severity: 'warning' },
  'Django': { all: ['manage.py'], severity: 'critical' },
  'Flask': { any: ['app.py', 'main.py', 'wsgi.py'], severity: 'info' },
  'FastAPI': { any: ['main.py', 'app.py'], severity: 'info' },
  'Spring Boot': { all: ['src/main/java'], severity: 'critical' },
  'Actix': { all: ['src/main.rs'], severity: 'critical' },
  'Axum': { all: ['src/main.rs'], severity: 'critical' },
  'Rocket': { all: ['src/main.rs'], severity: 'critical' },
  'Rails': { all: ['config/routes.rb'], severity: 'critical' },
  'Phoenix': { all: ['lib'], severity: 'critical' },
  'Laravel': { all: ['artisan', 'composer.json'], severity: 'critical' },
  'Flutter': { all: ['lib/main.dart'], severity: 'critical' },
  'Gin': { any: ['main.go', 'cmd'], severity: 'info' },
};

export const structureRules: CompatibilityRule[] = [
  {
    id: 'framework-expected-structure',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const expected = EXPECTED[ctx.stack.framework];
      if (!expected) return issues;
      let missing: string[] = [];
      if (expected.any) {
        const found = expected.any.some((p) => hasPath(ctx, [p]));
        if (!found) missing = expected.any;
      }
      if (expected.all) {
        const allMissing = expected.all.filter((p) => !hasPath(ctx, [p]));
        missing = [...missing, ...allMissing];
      }
      if (missing.length > 0) {
        issues.push({
          id: `structure-${ctx.stack.framework}`,
          title: `Expected ${ctx.stack.framework} structure not found`,
          category: 'structure',
          severity: expected.severity,
          description: `Missing expected paths: ${missing.join(', ')}.`,
          reason: `${ctx.stack.framework} projects typically include ${expected.any ? expected.any.join(', ') : expected.all?.join(', ')}.`,
          recommendation: `Create the expected ${ctx.stack.framework} directories and entry files.`,
          affectedFile: missing[0],
          detected: 'missing',
          expected: missing.join(', '),
          impact: 'Build tools and conventions may not resolve correctly.',
          suggestedAction: `Add ${missing.join(', ')} to the project root.`,
        });
      }
      return issues;
    },
  },
  {
    id: 'readme-present',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasReadme = ctx.detectedFiles.some(
        (f) => f.path === 'README.md' || f.path.endsWith('/README.md')
      );
      if (!hasReadme) {
        issues.push({
          id: 'readme-missing',
          title: 'README.md not found',
          category: 'structure',
          severity: 'info',
          description: 'No README.md was detected at the project root.',
          reason: 'A README is the entry point for contributors and operators.',
          recommendation: 'Add a README.md describing setup, scripts, and requirements.',
          affectedFile: 'README.md',
          detected: 'missing',
          expected: 'README.md',
          impact: 'Onboarding and deployment friction.',
          suggestedAction: 'Create a README.md with setup instructions.',
        });
      }
      return issues;
    },
  },
  {
    id: 'empty-src-folder',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const srcDir = ctx.files.find(
        (f) => f.isDirectory && (f.path === 'src' || f.path.split('/').pop() === 'src')
      );
      if (!srcDir) return issues;
      const hasFilesInSrc = ctx.files.some(
        (f) => !f.isDirectory && f.path.startsWith(srcDir.path + '/')
      );
      if (!hasFilesInSrc) {
        issues.push({
          id: 'empty-src',
          title: 'src/ directory is empty',
          category: 'structure',
          severity: 'warning',
          description: 'A src/ directory was detected but contains no files.',
          reason: 'Empty source folders usually indicate an incomplete scaffold.',
          recommendation: 'Add the expected entry files to src/.',
          affectedFile: 'src/',
          detected: 'empty',
          expected: 'at least one source file',
          impact: 'Build entry point may be missing.',
          suggestedAction: 'Add source files to src/.',
        });
      }
      return issues;
    },
  },
];
