import type { CompatibilityRule } from '../types';
import type { Issue } from '../../analyzer/types';

function hasPath(ctx: import('../types').RuleContext, candidates: string[]): boolean {
  return ctx.files.some((f) =>
    candidates.some((c) => f.path === c || f.path.startsWith(c + '/') || f.path.endsWith('/' + c))
  );
}

function hasFile(ctx: import('../types').RuleContext, name: string): boolean {
  return ctx.detectedFiles.some((f) => f.path === name || f.path.endsWith('/' + name));
}

const EXTENDED_EXPECTED: Record<
  string,
  { any?: string[]; all?: string[]; severity: 'critical' | 'warning' | 'info' }
> = {
  'Solid': { any: ['src', 'index.html', 'vite.config.ts'], severity: 'warning' },
  'Gatsby': { all: ['gatsby-config.js', 'src'], severity: 'warning' },
  'Quarkus': { all: ['src/main/java'], severity: 'critical' },
  'Sinatra': { any: ['app.rb', 'config.ru', 'server.rb'], severity: 'info' },
  'Symfony': { all: ['composer.json'], any: ['src', 'public'], severity: 'warning' },
  'Hono': { any: ['src', 'index.ts', 'app.ts'], severity: 'info' },
};

export const extendedStructureRules: CompatibilityRule[] = [
  {
    id: 'extended-framework-expected-structure',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const expected = EXTENDED_EXPECTED[ctx.stack.framework];
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
          id: `structure-extended-${ctx.stack.framework}`,
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
    id: 'package-json-main-entry',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.language !== 'JavaScript' && ctx.stack.language !== 'TypeScript') return issues;
      const pkgFile = ctx.files.find((f) => f.path === 'package.json' || f.path.endsWith('/package.json'));
      if (!pkgFile || !pkgFile.content) return issues;
      try {
        const p = JSON.parse(pkgFile.content);
        if (!p.main && !p.module && !p.exports && !p.bin) {
          issues.push({
            id: 'pkg-entry-point-missing',
            title: 'package.json has no entry point (main/module/exports/bin)',
            category: 'structure',
            severity: 'info',
            description: 'No main, module, exports, or bin field was found.',
            reason: 'An entry point tells the runtime where to start.',
            recommendation: 'Add a "main" field pointing to the entry file.',
            affectedFile: 'package.json',
            detected: 'no entry point',
            expected: 'main or module field',
            impact: 'Tools may not resolve the package correctly.',
            suggestedAction: 'Add a main/module field to package.json.',
          });
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'src-directory-present',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const lang = ctx.stack.language;
      const expectsSrc = ['TypeScript', 'JavaScript', 'Java', 'Kotlin', 'C#', 'Swift', 'Scala'].includes(lang);
      if (!expectsSrc) return issues;
      const hasSrc = hasPath(ctx, ['src']);
      if (!hasSrc && (ctx.stack.framework === 'NestJS' || ctx.stack.framework === 'Angular')) {
        issues.push({
          id: 'src-dir-missing',
          title: 'src/ directory not found',
          category: 'structure',
          severity: 'warning',
          description: 'The project does not include a src/ directory.',
          reason: `${ctx.stack.framework} projects conventionally use src/ for source code.`,
          recommendation: 'Create a src/ directory with the entry files.',
          affectedFile: 'src/',
          detected: 'missing',
          expected: 'src/ directory',
          impact: 'Framework conventions may not be met.',
          suggestedAction: 'Create a src/ directory.',
        });
      }
      return issues;
    },
  },
  {
    id: 'public-directory-present',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const frontendFrameworks = ['React', 'Vue', 'Vite', 'Astro', 'Gatsby'];
      if (!frontendFrameworks.includes(ctx.stack.framework as string)) return issues;
      const hasPublic = hasPath(ctx, ['public', 'static']);
      if (!hasPublic) {
        issues.push({
          id: 'public-dir-missing',
          title: 'public/ or static/ directory not found',
          category: 'structure',
          severity: 'info',
          description: 'No public/ or static/ directory was detected.',
          reason: 'Static assets are conventionally placed in public/.',
          recommendation: 'Create a public/ directory for static assets.',
          affectedFile: 'public/',
          detected: 'missing',
          expected: 'public/ directory',
          impact: 'Static assets may not be served correctly.',
          suggestedAction: 'Add a public/ directory.',
        });
      }
      return issues;
    },
  },
  {
    id: 'tests-directory-present',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasTests = ctx.files.some((f) =>
        f.path.includes('/test/') || f.path.includes('/tests/') ||
        f.path.includes('/__tests__/') || f.path.includes('/spec/') ||
        f.path.endsWith('.test.ts') || f.path.endsWith('.test.js') ||
        f.path.endsWith('.test.tsx') || f.path.endsWith('.test.jsx') ||
        f.path.endsWith('.spec.ts') || f.path.endsWith('.spec.js') ||
        f.path.endsWith('_test.go') || f.path.endsWith('_test.py')
      );
      if (!hasTests) {
        issues.push({
          id: 'tests-dir-missing',
          title: 'No test files or test directory found',
          category: 'structure',
          severity: 'info',
          description: 'No test files (*.test.*, *.spec.*, test/, tests/) were detected.',
          reason: 'Tests ensure code correctness and prevent regressions.',
          recommendation: 'Add a test directory or test files.',
          affectedFile: 'test/',
          detected: 'no tests',
          expected: 'test files present',
          impact: 'No automated verification of correctness.',
          suggestedAction: 'Add test files for the project.',
        });
      }
      return issues;
    },
  },
  {
    id: 'empty-project-root',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const nonDirFiles = ctx.files.filter((f) => !f.isDirectory);
      if (nonDirFiles.length === 0) {
        issues.push({
          id: 'project-empty',
          title: 'Project appears to be empty',
          category: 'structure',
          severity: 'critical',
          description: 'No files were found in the project.',
          reason: 'An empty project cannot be analyzed.',
          recommendation: 'Upload a project with source files.',
          affectedFile: 'project root',
          detected: 'empty',
          expected: 'at least one file',
          impact: 'No compatibility analysis is possible.',
          suggestedAction: 'Add source files to the project.',
        });
      }
      return issues;
    },
  },
  {
    id: 'deep-nesting-check',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      let maxDepth = 0;
      for (const f of ctx.files) {
        if (f.isDirectory) continue;
        const depth = f.path.split('/').length;
        if (depth > maxDepth) maxDepth = depth;
      }
      if (maxDepth > 12) {
        issues.push({
          id: 'deep-nesting',
          title: 'Project has deeply nested directories',
          category: 'structure',
          severity: 'info',
          description: `Maximum directory depth is ${maxDepth}.`,
          reason: 'Very deep nesting can cause path length issues on some systems.',
          recommendation: 'Consider flattening the directory structure.',
          affectedFile: 'project root',
          detected: `${maxDepth} levels deep`,
          expected: 'under 10 levels',
          impact: 'Path length limits may be exceeded on Windows.',
          suggestedAction: 'Flatten deeply nested directories.',
        });
      }
      return issues;
    },
  },
  {
    id: 'readme-substantial',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const readme = ctx.files.find((f) => !f.isDirectory && (f.path === 'README.md' || f.path.endsWith('/README.md')));
      if (!readme || !readme.content) return issues;
      if (readme.content.length < 100) {
        issues.push({
          id: 'readme-thin',
          title: 'README.md is very short',
          category: 'structure',
          severity: 'info',
          description: `README.md is only ${readme.content.length} characters.`,
          reason: 'A minimal README provides little guidance.',
          recommendation: 'Expand the README with setup, usage, and configuration details.',
          affectedFile: 'README.md',
          detected: `${readme.content.length} chars`,
          expected: 'at least 500 chars',
          impact: 'Onboarding is harder with minimal documentation.',
          suggestedAction: 'Expand the README content.',
        });
      }
      return issues;
    },
  },
  {
    id: 'gitignore-covers-node-modules',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.packageManager !== 'npm' && ctx.stack.packageManager !== 'pnpm' &&
          ctx.stack.packageManager !== 'yarn' && ctx.stack.packageManager !== 'bun') return issues;
      const gitignore = ctx.files.find((f) => !f.isDirectory && (f.path === '.gitignore' || f.path.endsWith('/.gitignore')));
      if (!gitignore || !gitignore.content) return issues;
      if (!/node_modules/i.test(gitignore.content)) {
        issues.push({
          id: 'gitignore-node-modules-missing',
          title: '.gitignore does not exclude node_modules',
          category: 'structure',
          severity: 'warning',
          description: 'node_modules is not in .gitignore.',
          reason: 'Committing node_modules bloats the repository.',
          recommendation: 'Add node_modules/ to .gitignore.',
          affectedFile: '.gitignore',
          detected: 'node_modules not ignored',
          expected: 'node_modules/ in .gitignore',
          impact: 'Repository size may grow significantly.',
          suggestedAction: 'Add node_modules/ to .gitignore.',
        });
      }
      return issues;
    },
  },
  {
    id: 'gitignore-covers-build-output',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const gitignore = ctx.files.find((f) => !f.isDirectory && (f.path === '.gitignore' || f.path.endsWith('/.gitignore')));
      if (!gitignore || !gitignore.content) return issues;
      const buildOutputs = ['dist/', 'build/'];
      const missing = buildOutputs.filter((d) => !gitignore.content!.includes(d));
      if (missing.length > 0 && (ctx.stack.buildTool === 'Vite' || ctx.stack.buildTool === 'Webpack' || ctx.stack.buildTool === 'Rollup')) {
        issues.push({
          id: 'gitignore-build-output-missing',
          title: '.gitignore does not exclude build output',
          category: 'structure',
          severity: 'info',
          description: `Build output directories not in .gitignore: ${missing.join(', ')}.`,
          reason: 'Build artifacts should not be committed.',
          recommendation: `Add ${missing.join(', ')} to .gitignore.`,
          affectedFile: '.gitignore',
          detected: `${missing.join(', ')} not ignored`,
          expected: `${missing.join(', ')} in .gitignore`,
          impact: 'Build artifacts may be committed accidentally.',
          suggestedAction: `Add ${missing.join(', ')} to .gitignore.`,
        });
      }
      return issues;
    },
  },
  {
    id: 'dockerfile-dotdot-path',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const docker = ctx.detectedFiles.find((f) => f.path.endsWith('Dockerfile'));
      if (!docker) return issues;
      const content = ctx.files.find((f) => f.path === docker.path)?.content;
      if (!content) return issues;
      if (/\.\.\//.test(content)) {
        issues.push({
          id: 'dockerfile-dotdot-path',
          title: 'Dockerfile references paths outside build context',
          category: 'structure',
          severity: 'warning',
          description: 'The Dockerfile contains "../" paths.',
          reason: 'Docker builds cannot access files outside the build context.',
          recommendation: 'Keep all referenced files within the build context.',
          affectedFile: 'Dockerfile',
          detected: '../ paths',
          expected: 'paths within context',
          impact: 'Build may fail or copy unexpected files.',
          suggestedAction: 'Remove ../ paths from the Dockerfile.',
        });
      }
      return issues;
    },
  },
  {
    id: 'multiple-package-json',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const pkgJsons = ctx.files.filter((f) => !f.isDirectory && f.path.endsWith('package.json'));
      if (pkgJsons.length > 1) {
        const hasWorkspaces = pkgJsons.some((f) => {
          try {
            const p = JSON.parse(f.content ?? '{}');
            return !!p.workspaces;
          } catch {
            return false;
          }
        });
        if (!hasWorkspaces) {
          issues.push({
            id: 'multiple-pkg-json-no-workspaces',
            title: 'Multiple package.json files without workspaces',
            category: 'structure',
            severity: 'info',
            description: `${pkgJsons.length} package.json files found, but none declare workspaces.`,
            reason: 'Monorepos should declare workspaces in the root package.json.',
            recommendation: 'Add "workspaces" to the root package.json or consolidate.',
            affectedFile: 'package.json',
            detected: `${pkgJsons.length} package.json files`,
            expected: 'workspaces field',
            impact: 'Dependency management is fragmented.',
            suggestedAction: 'Configure workspaces in the root package.json.',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'config-file-at-root',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const rootConfigs = ['package.json', 'tsconfig.json', 'Cargo.toml', 'go.mod', 'pyproject.toml'];
      const found = rootConfigs.some((c) => hasFile(ctx, c));
      if (!found && ctx.stack.language !== 'Unknown') {
        issues.push({
          id: 'root-config-missing',
          title: 'No root configuration file found',
          category: 'structure',
          severity: 'info',
          description: 'No package.json, tsconfig.json, Cargo.toml, go.mod, or pyproject.toml at root.',
          reason: 'Root config files anchor the project and its tooling.',
          recommendation: 'Add the appropriate config file for the detected language.',
          affectedFile: 'project root',
          detected: 'no root config',
          expected: 'at least one root config',
          impact: 'Tooling may not detect the project correctly.',
          suggestedAction: 'Add a root configuration file.',
        });
      }
      return issues;
    },
  },
  {
    id: 'nested-zip-archive',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasNestedZip = ctx.files.some((f) => !f.isDirectory && /\.zip$/i.test(f.path));
      if (hasNestedZip) {
        issues.push({
          id: 'nested-zip-found',
          title: 'Nested ZIP archive detected',
          category: 'structure',
          severity: 'info',
          description: 'A .zip file was found inside the uploaded archive.',
          reason: 'Nested archives may indicate an incorrectly packaged project.',
          recommendation: 'Extract nested archives or repackage the project.',
          affectedFile: 'project root',
          detected: 'nested .zip',
          expected: 'extracted files',
          impact: 'Nested content is not analyzed.',
          suggestedAction: 'Extract nested archives before uploading.',
        });
      }
      return issues;
    },
  },
  {
    id: 'unicode-filename-check',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasUnicode = ctx.files.some((f) => /[^\x00-\x7F]/.test(f.path));
      if (hasUnicode) {
        issues.push({
          id: 'unicode-filenames',
          title: 'Non-ASCII (Unicode) filenames detected',
          category: 'structure',
          severity: 'info',
          description: 'Some filenames contain non-ASCII characters.',
          reason: 'Unicode filenames may cause issues on some filesystems and CI systems.',
          recommendation: 'Rename files to use ASCII-only characters where possible.',
          affectedFile: 'project root',
          detected: 'non-ASCII filenames',
          expected: 'ASCII filenames',
          impact: 'Cross-platform compatibility may be reduced.',
          suggestedAction: 'Rename files with non-ASCII characters.',
        });
      }
      return issues;
    },
  },
];
