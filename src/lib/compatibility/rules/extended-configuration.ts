import type { CompatibilityRule } from '../types';
import type { Issue } from '../../analyzer/types';
import { readFile } from './shared';

export const extendedConfigurationRules: CompatibilityRule[] = [
  {
    id: 'tsconfig-strict-mode',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.language !== 'TypeScript') return issues;
      const tsconfig = readFile(ctx, 'tsconfig.json');
      if (!tsconfig) return issues;
      try {
        const p = JSON.parse(tsconfig);
        const opts = p.compilerOptions ?? {};
        if (!opts.strict) {
          issues.push({
            id: 'tsconfig-strict-missing',
            title: 'TypeScript strict mode not enabled',
            category: 'configuration',
            severity: 'warning',
            description: 'tsconfig.json does not set "strict": true.',
            reason: 'Strict mode catches common type errors at compile time.',
            recommendation: 'Add "strict": true to compilerOptions.',
            affectedFile: 'tsconfig.json',
            detected: 'strict not set',
            expected: 'strict: true',
            impact: 'Type safety is reduced.',
            suggestedAction: 'Enable strict mode in tsconfig.json.',
          });
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'tsconfig-target-modern',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.language !== 'TypeScript') return issues;
      const tsconfig = readFile(ctx, 'tsconfig.json');
      if (!tsconfig) return issues;
      try {
        const p = JSON.parse(tsconfig);
        const target = p.compilerOptions?.target?.toUpperCase();
        if (target && ['ES3', 'ES5', 'ES6', 'ES2015', 'ES2016', 'ES2017', 'ES2018', 'ES2019', 'ES2020'].includes(target)) {
          issues.push({
            id: 'tsconfig-target-outdated',
            title: 'TypeScript target is outdated',
            category: 'configuration',
            severity: 'info',
            description: `tsconfig.json targets "${target}".`,
            reason: 'Modern browsers and Node support ES2022+.',
            recommendation: 'Bump target to ES2022 or higher.',
            affectedFile: 'tsconfig.json',
            detected: target,
            expected: 'ES2022+',
            impact: 'Modern syntax is down-leveled unnecessarily.',
            suggestedAction: 'Update target in tsconfig.json.',
          });
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'eslint-config-present',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.language !== 'TypeScript' && ctx.stack.language !== 'JavaScript') return issues;
      const hasEslint = ctx.detectedFiles.some((f) =>
        f.path === '.eslintrc' || f.path.endsWith('/.eslintrc') ||
        f.path.endsWith('.eslintrc.json') || f.path.endsWith('.eslintrc.js') ||
        f.path.endsWith('.eslintrc.cjs') || f.path.endsWith('.eslintrc.mjs') ||
        f.path === 'eslint.config.js' || f.path === 'eslint.config.mjs'
      );
      if (!hasEslint) {
        issues.push({
          id: 'eslint-config-missing',
          title: 'No ESLint configuration found',
          category: 'configuration',
          severity: 'info',
          description: 'The project does not include an ESLint configuration.',
          reason: 'Linting catches code quality issues early.',
          recommendation: 'Add an ESLint config (flat config recommended).',
          affectedFile: 'eslint.config.js',
          detected: 'missing',
          expected: 'eslint config present',
          impact: 'Code quality issues may go unnoticed.',
          suggestedAction: 'Add an ESLint configuration file.',
        });
      }
      return issues;
    },
  },
  {
    id: 'prettier-config-present',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.language !== 'TypeScript' && ctx.stack.language !== 'JavaScript') return issues;
      const hasPrettier = ctx.detectedFiles.some((f) =>
        f.path === '.prettierrc' || f.path.endsWith('.prettierrc') ||
        f.path.endsWith('.prettierrc.json') || f.path.endsWith('.prettierrc.js') ||
        f.path.endsWith('.prettierrc.cjs') || f.path.endsWith('.prettierrc.mjs') ||
        f.path === 'prettier.config.js' || f.path === 'prettier.config.mjs'
      );
      if (!hasPrettier) {
        issues.push({
          id: 'prettier-config-missing',
          title: 'No Prettier configuration found',
          category: 'configuration',
          severity: 'info',
          description: 'The project does not include a Prettier configuration.',
          reason: 'Formatting consistency reduces diff noise.',
          recommendation: 'Add a .prettierrc file.',
          affectedFile: '.prettierrc',
          detected: 'missing',
          expected: 'prettier config present',
          impact: 'Inconsistent formatting across contributors.',
          suggestedAction: 'Add a Prettier configuration file.',
        });
      }
      return issues;
    },
  },
  {
    id: 'gitignore-present',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasGitignore = ctx.detectedFiles.some(
        (f) => f.path === '.gitignore' || f.path.endsWith('/.gitignore')
      );
      if (!hasGitignore) {
        issues.push({
          id: 'gitignore-missing',
          title: '.gitignore not found',
          category: 'configuration',
          severity: 'warning',
          description: 'No .gitignore file was detected.',
          reason: 'Without .gitignore, build artifacts and secrets may be committed.',
          recommendation: 'Add a .gitignore appropriate for the stack.',
          affectedFile: '.gitignore',
          detected: 'missing',
          expected: '.gitignore present',
          impact: 'Unwanted files may be committed to the repository.',
          suggestedAction: 'Create a .gitignore file.',
        });
      }
      return issues;
    },
  },
  {
    id: 'editorconfig-present',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasEditorconfig = ctx.detectedFiles.some(
        (f) => f.path === '.editorconfig' || f.path.endsWith('/.editorconfig')
      );
      if (!hasEditorconfig) {
        issues.push({
          id: 'editorconfig-missing',
          title: '.editorconfig not found',
          category: 'configuration',
          severity: 'info',
          description: 'No .editorconfig file was detected.',
          reason: 'EditorConfig ensures consistent indentation across editors.',
          recommendation: 'Add a .editorconfig file.',
          affectedFile: '.editorconfig',
          detected: 'missing',
          expected: '.editorconfig present',
          impact: 'Inconsistent formatting across editors.',
          suggestedAction: 'Create a .editorconfig file.',
        });
      }
      return issues;
    },
  },
  {
    id: 'vite-config-present',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.buildTool !== 'Vite') return issues;
      const hasViteConfig = ctx.detectedFiles.some((f) =>
        f.path.startsWith('vite.config.') || f.path.includes('/vite.config.')
      );
      if (!hasViteConfig) {
        issues.push({
          id: 'vite-config-missing',
          title: 'Vite config file not found',
          category: 'configuration',
          severity: 'info',
          description: 'Vite was detected as the build tool but no config file was found.',
          reason: 'A vite.config file allows build customization.',
          recommendation: 'Add a vite.config.ts or vite.config.js.',
          affectedFile: 'vite.config.ts',
          detected: 'missing',
          expected: 'vite.config present',
          impact: 'Build defaults may not match project needs.',
          suggestedAction: 'Create a vite.config file.',
        });
      }
      return issues;
    },
  },
  {
    id: 'next-config-present',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.framework !== 'Next.js') return issues;
      const hasNextConfig = ctx.detectedFiles.some((f) =>
        f.path.startsWith('next.config.') || f.path.includes('/next.config.')
      );
      if (!hasNextConfig) {
        issues.push({
          id: 'next-config-missing',
          title: 'Next.js config file not found',
          category: 'configuration',
          severity: 'info',
          description: 'Next.js was detected but no next.config file was found.',
          reason: 'A next.config file enables features like image optimization and rewrites.',
          recommendation: 'Add a next.config.js or next.config.mjs.',
          affectedFile: 'next.config.mjs',
          detected: 'missing',
          expected: 'next.config present',
          impact: 'Framework features may not be configured.',
          suggestedAction: 'Create a next.config file.',
        });
      }
      return issues;
    },
  },
  {
    id: 'tailwind-config-present',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasTailwindDep = ctx.files.some((f) =>
        f.path === 'package.json' && f.content?.includes('tailwindcss')
      );
      if (!hasTailwindDep) return issues;
      const hasTailwindConfig = ctx.detectedFiles.some((f) =>
        f.path.startsWith('tailwind.config.') || f.path.includes('/tailwind.config.')
      );
      if (!hasTailwindConfig) {
        issues.push({
          id: 'tailwind-config-missing',
          title: 'Tailwind CSS config not found',
          category: 'configuration',
          severity: 'info',
          description: 'tailwindcss is a dependency but no config file was found.',
          reason: 'A tailwind.config enables theme customization and content scanning.',
          recommendation: 'Add a tailwind.config.js or tailwind.config.ts.',
          affectedFile: 'tailwind.config.js',
          detected: 'missing',
          expected: 'tailwind.config present',
          impact: 'Theme customization is unavailable.',
          suggestedAction: 'Create a tailwind.config file.',
        });
      }
      return issues;
    },
  },
  {
    id: 'jest-or-vitest-config-present',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.language !== 'TypeScript' && ctx.stack.language !== 'JavaScript') return issues;
      const hasTestConfig = ctx.detectedFiles.some((f) =>
        f.path.startsWith('jest.config.') || f.path.startsWith('vitest.config.') ||
        f.path.includes('/jest.config.') || f.path.includes('/vitest.config.')
      );
      const hasTestScript = ctx.files.some((f) =>
        f.path === 'package.json' && f.content?.includes('"test"')
      );
      if (!hasTestConfig && !hasTestScript) {
        issues.push({
          id: 'test-config-missing',
          title: 'No test runner configuration found',
          category: 'configuration',
          severity: 'info',
          description: 'No Jest or Vitest config was detected.',
          reason: 'A test runner config ensures consistent test execution.',
          recommendation: 'Add a vitest.config.ts or jest.config.ts.',
          affectedFile: 'vitest.config.ts',
          detected: 'missing',
          expected: 'test config present',
          impact: 'No standardized test setup.',
          suggestedAction: 'Add a test runner configuration.',
        });
      }
      return issues;
    },
  },
  {
    id: 'dockerfile-config-valid',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      const docker = ctx.detectedFiles.find((f) => f.path.endsWith('Dockerfile'));
      if (!docker) return issues;
      const content = readFile(ctx, 'Dockerfile');
      if (!content) return issues;
      if (!/^FROM\s+/m.test(content)) {
        issues.push({
          id: 'dockerfile-no-from',
          title: 'Dockerfile missing FROM instruction',
          category: 'configuration',
          severity: 'critical',
          description: 'The Dockerfile does not contain a FROM instruction.',
          reason: 'A base image is required to build a container.',
          recommendation: 'Add a FROM line with a base image.',
          affectedFile: 'Dockerfile',
          detected: 'no FROM',
          expected: 'FROM <base-image>',
          impact: 'The image cannot be built.',
          suggestedAction: 'Add a FROM instruction to the Dockerfile.',
        });
      }
      return issues;
    },
  },
  {
    id: 'dockerfile-non-root-user',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      const docker = ctx.detectedFiles.find((f) => f.path.endsWith('Dockerfile'));
      if (!docker) return issues;
      const content = readFile(ctx, 'Dockerfile');
      if (!content) return issues;
      if (/^FROM\s+/m.test(content) && !/USER\s+\S+/m.test(content)) {
        issues.push({
          id: 'dockerfile-root-user',
          title: 'Dockerfile runs as root',
          category: 'configuration',
          severity: 'warning',
          description: 'The Dockerfile does not specify a non-root USER.',
          reason: 'Running as root is a security risk in production.',
          recommendation: 'Add a USER directive with a non-root user.',
          affectedFile: 'Dockerfile',
          detected: 'no USER',
          expected: 'USER <non-root>',
          impact: 'Container processes run with elevated privileges.',
          suggestedAction: 'Add a non-root USER to the Dockerfile.',
        });
      }
      return issues;
    },
  },
  {
    id: 'dockerfile-healthcheck',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      const docker = ctx.detectedFiles.find((f) => f.path.endsWith('Dockerfile'));
      if (!docker) return issues;
      const content = readFile(ctx, 'Dockerfile');
      if (!content) return issues;
      if (/^FROM\s+/m.test(content) && !/HEALTHCHECK\s+/m.test(content)) {
        issues.push({
          id: 'dockerfile-no-healthcheck',
          title: 'Dockerfile missing HEALTHCHECK',
          category: 'configuration',
          severity: 'info',
          description: 'The Dockerfile does not define a HEALTHCHECK.',
          reason: 'Health checks help orchestrators detect unhealthy containers.',
          recommendation: 'Add a HEALTHCHECK instruction.',
          affectedFile: 'Dockerfile',
          detected: 'no HEALTHCHECK',
          expected: 'HEALTHCHECK instruction',
          impact: 'Orchestrators cannot detect container health.',
          suggestedAction: 'Add a HEALTHCHECK to the Dockerfile.',
        });
      }
      return issues;
    },
  },
  {
    id: 'ci-config-present',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasCI = ctx.files.some((f) =>
        f.path.startsWith('.github/workflows/') ||
        f.path.includes('/.gitlab-ci.yml') ||
        f.path.includes('/.circleci/') ||
        f.path === 'Jenkinsfile' || f.path.endsWith('/Jenkinsfile') ||
        f.path === 'azure-pipelines.yml' || f.path.endsWith('/azure-pipelines.yml')
      );
      if (!hasCI) {
        issues.push({
          id: 'ci-config-missing',
          title: 'No CI/CD configuration found',
          category: 'configuration',
          severity: 'info',
          description: 'No GitHub Actions, GitLab CI, CircleCI, or Jenkinsfile detected.',
          reason: 'CI/CD automates testing and deployment.',
          recommendation: 'Add a CI workflow (e.g. .github/workflows/ci.yml).',
          affectedFile: '.github/workflows/ci.yml',
          detected: 'missing',
          expected: 'CI config present',
          impact: 'No automated testing or deployment.',
          suggestedAction: 'Add a CI configuration file.',
        });
      }
      return issues;
    },
  },
  {
    id: 'license-file-present',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasLicense = ctx.detectedFiles.some((f) =>
        f.path === 'LICENSE' || f.path.endsWith('/LICENSE') ||
        f.path === 'LICENSE.md' || f.path.endsWith('/LICENSE.md') ||
        f.path === 'LICENSE.txt' || f.path.endsWith('/LICENSE.txt')
      );
      if (!hasLicense) {
        issues.push({
          id: 'license-missing',
          title: 'No LICENSE file found',
          category: 'configuration',
          severity: 'info',
          description: 'No LICENSE file was detected at the project root.',
          reason: 'A license file clarifies usage and distribution rights.',
          recommendation: 'Add a LICENSE file (e.g. MIT, Apache-2.0).',
          affectedFile: 'LICENSE',
          detected: 'missing',
          expected: 'LICENSE file',
          impact: 'Legal usage rights are unclear.',
          suggestedAction: 'Add a LICENSE file.',
        });
      }
      return issues;
    },
  },
  {
    id: 'changelog-present',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasChangelog = ctx.detectedFiles.some((f) =>
        f.path === 'CHANGELOG.md' || f.path.endsWith('/CHANGELOG.md')
      );
      if (!hasChangelog) {
        issues.push({
          id: 'changelog-missing',
          title: 'No CHANGELOG.md found',
          category: 'configuration',
          severity: 'info',
          description: 'No CHANGELOG.md was detected.',
          reason: 'A changelog tracks version history and release notes.',
          recommendation: 'Add a CHANGELOG.md following Keep a Changelog format.',
          affectedFile: 'CHANGELOG.md',
          detected: 'missing',
          expected: 'CHANGELOG.md',
          impact: 'Release history is not documented.',
          suggestedAction: 'Create a CHANGELOG.md.',
        });
      }
      return issues;
    },
  },
  {
    id: 'contributing-guide-present',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasContributing = ctx.detectedFiles.some((f) =>
        f.path === 'CONTRIBUTING.md' || f.path.endsWith('/CONTRIBUTING.md')
      );
      if (!hasContributing) {
        issues.push({
          id: 'contributing-missing',
          title: 'No CONTRIBUTING.md found',
          category: 'configuration',
          severity: 'info',
          description: 'No CONTRIBUTING.md was detected.',
          reason: 'A contributing guide standardizes how changes are proposed.',
          recommendation: 'Add a CONTRIBUTING.md with guidelines.',
          affectedFile: 'CONTRIBUTING.md',
          detected: 'missing',
          expected: 'CONTRIBUTING.md',
          impact: 'Contributors lack guidance on project conventions.',
          suggestedAction: 'Create a CONTRIBUTING.md.',
        });
      }
      return issues;
    },
  },
  {
    id: 'package-json-type-module',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.language !== 'TypeScript' && ctx.stack.language !== 'JavaScript') return issues;
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        const hasEsmDeps = Object.keys({ ...(p.dependencies ?? {}), ...(p.devDependencies ?? {}) } as Record<string, string>)
          .some((d) => d.startsWith('vite') || d === 'next' || d === 'astro' || d === 'svelte');
        if (hasEsmDeps && p.type !== 'module') {
          issues.push({
            id: 'pkg-type-module-missing',
            title: 'package.json does not set "type": "module"',
            category: 'configuration',
            severity: 'info',
            description: 'ESM-oriented dependencies detected but type is not "module".',
            reason: 'Without type: module, .js files are treated as CommonJS.',
            recommendation: 'Add "type": "module" to package.json.',
            affectedFile: 'package.json',
            detected: p.type ?? 'not set',
            expected: 'module',
            impact: 'ESM imports may fail in Node.',
            suggestedAction: 'Set "type": "module" in package.json.',
          });
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'tsconfig-module-resolution',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.language !== 'TypeScript') return issues;
      const tsconfig = readFile(ctx, 'tsconfig.json');
      if (!tsconfig) return issues;
      try {
        const p = JSON.parse(tsconfig);
        const opts = p.compilerOptions ?? {};
        if (!opts.moduleResolution && !opts.module) {
          issues.push({
            id: 'tsconfig-module-resolution-missing',
            title: 'tsconfig.json missing moduleResolution',
            category: 'configuration',
            severity: 'info',
            description: 'No moduleResolution is set in tsconfig.json.',
            reason: 'moduleResolution controls how imports are resolved.',
            recommendation: 'Set moduleResolution to "bundler" or "node".',
            affectedFile: 'tsconfig.json',
            detected: 'not set',
            expected: 'bundler or node',
            impact: 'Import resolution may be inconsistent.',
            suggestedAction: 'Add moduleResolution to tsconfig.json.',
          });
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'env-example-gitignored',
    category: 'configuration',
    run: (ctx) => {
      const issues: Issue[] = [];
      const envFile = ctx.detectedFiles.find((f) => f.path === '.env' || f.path.endsWith('/.env'));
      if (!envFile) return issues;
      const gitignore = readFile(ctx, '.gitignore');
      if (gitignore && !/^\s*\.env\s*$/m.test(gitignore) && !/^\s*\.env$/m.test(gitignore)) {
        issues.push({
          id: 'env-not-gitignored',
          title: '.env is not in .gitignore',
          category: 'configuration',
          severity: 'critical',
          description: 'A .env file exists but .gitignore does not exclude it.',
          reason: 'Even if .env is not currently committed, it may be added accidentally.',
          recommendation: 'Add .env to .gitignore.',
          affectedFile: '.gitignore',
          detected: '.env not ignored',
          expected: '.env in .gitignore',
          impact: 'Secrets may be committed accidentally.',
          suggestedAction: 'Add .env to .gitignore.',
        });
      }
      return issues;
    },
  },
];
