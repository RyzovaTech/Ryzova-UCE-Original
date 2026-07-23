import type { CompatibilityRule } from '../types';
import type { Issue } from '../../analyzer/types';
import { readFile } from './shared';

export const monorepoRules: CompatibilityRule[] = [
  {
    id: 'nx-config-present',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasNx = ctx.detectedFiles.some(
        (f) => f.path === 'nx.json' || f.path.endsWith('/nx.json')
      );
      if (!hasNx) return issues;
      const pkg = readFile(ctx, 'package.json');
      if (pkg) {
        try {
          const p = JSON.parse(pkg);
          if (!p.devDependencies?.nx && !p.dependencies?.nx) {
            issues.push({
              id: 'nx-not-installed',
              title: 'nx.json found but nx is not a dependency',
              category: 'structure',
              severity: 'warning',
              description: 'nx.json exists but nx is not declared in package.json.',
              reason: 'The Nx CLI must be installed to use nx.json configuration.',
              recommendation: 'Install nx as a devDependency.',
              affectedFile: 'package.json',
              detected: 'nx.json without nx dep',
              expected: 'nx in devDependencies',
              impact: 'Nx commands will not work.',
              suggestedAction: 'npm install -D nx',
            });
          }
        } catch {
          // ignore
        }
      }
      return issues;
    },
  },
  {
    id: 'turbo-config-present',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasTurbo = ctx.detectedFiles.some(
        (f) => f.path === 'turbo.json' || f.path.endsWith('/turbo.json')
      );
      if (!hasTurbo) return issues;
      const turboContent = readFile(ctx, 'turbo.json');
      if (turboContent) {
        try {
          const t = JSON.parse(turboContent);
          if (!t.pipeline && !t.tasks) {
            issues.push({
              id: 'turbo-no-pipeline',
              title: 'turbo.json missing pipeline/tasks',
              category: 'structure',
              severity: 'warning',
              description: 'turbo.json does not define a pipeline or tasks section.',
              reason: 'Turborepo needs task definitions to run builds.',
              recommendation: 'Add a "pipeline" or "tasks" section to turbo.json.',
              affectedFile: 'turbo.json',
              detected: 'no pipeline/tasks',
              expected: 'pipeline section',
              impact: 'Turborepo cannot run tasks.',
              suggestedAction: 'Add pipeline definitions to turbo.json.',
            });
          }
        } catch {
          // ignore
        }
      }
      return issues;
    },
  },
  {
    id: 'lerna-config-present',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasLerna = ctx.detectedFiles.some(
        (f) => f.path === 'lerna.json' || f.path.endsWith('/lerna.json')
      );
      if (!hasLerna) return issues;
      const lernaContent = readFile(ctx, 'lerna.json');
      if (lernaContent) {
        try {
          const l = JSON.parse(lernaContent);
          if (!l.packages && !l.useWorkspaces) {
            issues.push({
              id: 'lerna-no-packages',
              title: 'lerna.json missing packages field',
              category: 'structure',
              severity: 'info',
              description: 'lerna.json does not declare packages or useWorkspaces.',
              reason: 'Lerna needs to know which packages to manage.',
              recommendation: 'Add "packages" or set "useWorkspaces": true.',
              affectedFile: 'lerna.json',
              detected: 'no packages',
              expected: 'packages array',
              impact: 'Lerna may not detect workspace packages.',
              suggestedAction: 'Add packages to lerna.json.',
            });
          }
        } catch {
          // ignore
        }
      }
      return issues;
    },
  },
  {
    id: 'rush-config-present',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasRush = ctx.detectedFiles.some(
        (f) => f.path === 'rush.json' || f.path.endsWith('/rush.json')
      );
      if (!hasRush) return issues;
      const rushContent = readFile(ctx, 'rush.json');
      if (rushContent && !/projectFolder|projects/i.test(rushContent)) {
        issues.push({
          id: 'rush-no-projects',
          title: 'rush.json missing project configuration',
          category: 'structure',
          severity: 'warning',
          description: 'rush.json does not declare projectFolder or projects.',
          reason: 'Rush needs project registration to manage the monorepo.',
          recommendation: 'Add "projects" array to rush.json.',
          affectedFile: 'rush.json',
          detected: 'no projects',
          expected: 'projects array',
          impact: 'Rush cannot manage the monorepo.',
          suggestedAction: 'Configure projects in rush.json.',
        });
      }
      return issues;
    },
  },
  {
    id: 'pnpm-workspace-present',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasPnpmWs = ctx.detectedFiles.some(
        (f) => f.path === 'pnpm-workspace.yaml' || f.path.endsWith('/pnpm-workspace.yaml')
      );
      if (!hasPnpmWs) return issues;
      const content = readFile(ctx, 'pnpm-workspace.yaml');
      if (content && !/packages\s*:/i.test(content)) {
        issues.push({
          id: 'pnpm-workspace-no-packages',
          title: 'pnpm-workspace.yaml missing packages',
          category: 'structure',
          severity: 'warning',
          description: 'pnpm-workspace.yaml does not declare a packages section.',
          reason: 'pnpm needs to know which directories are workspace packages.',
          recommendation: 'Add "packages:" with glob patterns.',
          affectedFile: 'pnpm-workspace.yaml',
          detected: 'no packages',
          expected: 'packages section',
          impact: 'Workspace packages are not detected.',
          suggestedAction: 'Add packages to pnpm-workspace.yaml.',
        });
      }
      return issues;
    },
  },
  {
    id: 'yarn-workspace-config',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        if (p.workspaces) {
          if (Array.isArray(p.workspaces) && p.workspaces.length === 0) {
            issues.push({
              id: 'yarn-workspace-empty',
              title: 'Yarn workspaces array is empty',
              category: 'structure',
              severity: 'info',
              description: 'package.json declares workspaces but the array is empty.',
              reason: 'An empty workspaces array means no packages are included.',
              recommendation: 'Add glob patterns to the workspaces array.',
              affectedFile: 'package.json',
              detected: 'empty workspaces',
              expected: 'non-empty workspaces',
              impact: 'No workspace packages are detected.',
              suggestedAction: 'Add workspace glob patterns.',
            });
          }
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'monorepo-root-package-json',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasMonorepoConfig = ctx.detectedFiles.some(
        (f) => f.path === 'nx.json' || f.path.endsWith('/nx.json') ||
              f.path === 'turbo.json' || f.path.endsWith('/turbo.json') ||
              f.path === 'lerna.json' || f.path.endsWith('/lerna.json') ||
              f.path === 'rush.json' || f.path.endsWith('/rush.json') ||
              f.path === 'pnpm-workspace.yaml' || f.path.endsWith('/pnpm-workspace.yaml')
      );
      if (!hasMonorepoConfig) return issues;
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) {
        issues.push({
          id: 'monorepo-no-root-pkg',
          title: 'Monorepo detected but no root package.json',
          category: 'structure',
          severity: 'warning',
          description: 'A monorepo config was found but no root package.json exists.',
          reason: 'The root package.json coordinates workspace dependencies.',
          recommendation: 'Add a root package.json with workspace configuration.',
          affectedFile: 'package.json',
          detected: 'missing',
          expected: 'root package.json',
          impact: 'Workspace tooling may not function.',
          suggestedAction: 'Create a root package.json.',
        });
      }
      return issues;
    },
  },
  {
    id: 'monorepo-private-package',
    category: 'structure',
    run: (ctx) => {
      const issues: Issue[] = [];
      const hasMonorepoConfig = ctx.detectedFiles.some(
        (f) => f.path === 'nx.json' || f.path.endsWith('/nx.json') ||
              f.path === 'turbo.json' || f.path.endsWith('/turbo.json') ||
              f.path === 'lerna.json' || f.path.endsWith('/lerna.json')
      );
      if (!hasMonorepoConfig) return issues;
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        if (!p.private) {
          issues.push({
            id: 'monorepo-not-private',
            title: 'Monorepo root package.json is not private',
            category: 'structure',
            severity: 'warning',
            description: 'The root package.json of a monorepo should be private.',
            reason: 'Publishing the root workspace package is almost never intended.',
            recommendation: 'Add "private": true to the root package.json.',
            affectedFile: 'package.json',
            detected: 'not private',
            expected: 'private: true',
            impact: 'The root package could be accidentally published.',
            suggestedAction: 'Set "private": true in package.json.',
          });
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
];
