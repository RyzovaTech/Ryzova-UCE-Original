import type { CompatibilityRule } from '../types';
import type { Issue } from '../../analyzer/types';
import { readFile } from './shared';

export const extendedDependencyRules: CompatibilityRule[] = [
  {
    id: 'pnpm-lockfile-present',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.packageManager !== 'pnpm') return issues;
      if (!ctx.detectedFiles.some((f) => f.path.endsWith('pnpm-lock.yaml'))) {
        issues.push({
          id: 'lockfile-missing-pnpm',
          title: 'pnpm lockfile missing',
          category: 'dependencies',
          severity: 'warning',
          description: 'pnpm-lock.yaml was not found.',
          reason: 'Without a lockfile, dependency resolution is non-deterministic.',
          recommendation: 'Run `pnpm install` and commit pnpm-lock.yaml.',
          affectedFile: 'package.json',
          detected: 'no lockfile',
          expected: 'pnpm-lock.yaml',
          impact: 'Different versions may be installed across environments.',
          suggestedAction: 'Commit pnpm-lock.yaml.',
        });
      }
      return issues;
    },
  },
  {
    id: 'yarn-lockfile-present',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.packageManager !== 'yarn') return issues;
      if (!ctx.detectedFiles.some((f) => f.path.endsWith('yarn.lock'))) {
        issues.push({
          id: 'lockfile-missing-yarn',
          title: 'yarn lockfile missing',
          category: 'dependencies',
          severity: 'warning',
          description: 'yarn.lock was not found.',
          reason: 'Without a lockfile, dependency resolution is non-deterministic.',
          recommendation: 'Run `yarn install` and commit yarn.lock.',
          affectedFile: 'package.json',
          detected: 'no lockfile',
          expected: 'yarn.lock',
          impact: 'Different versions may be installed across environments.',
          suggestedAction: 'Commit yarn.lock.',
        });
      }
      return issues;
    },
  },
  {
    id: 'bun-lockfile-present',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.packageManager !== 'bun') return issues;
      if (!ctx.detectedFiles.some((f) => f.path.endsWith('bun.lockb') || f.path.endsWith('bun.lock'))) {
        issues.push({
          id: 'lockfile-missing-bun',
          title: 'Bun lockfile missing',
          category: 'dependencies',
          severity: 'warning',
          description: 'bun.lockb or bun.lock was not found.',
          reason: 'Without a lockfile, dependency resolution is non-deterministic.',
          recommendation: 'Run `bun install` and commit the lockfile.',
          affectedFile: 'package.json',
          detected: 'no lockfile',
          expected: 'bun.lockb',
          impact: 'Different versions may be installed across environments.',
          suggestedAction: 'Commit the Bun lockfile.',
        });
      }
      return issues;
    },
  },
  {
    id: 'cargo-lockfile-present',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.packageManager !== 'cargo') return issues;
      if (!ctx.detectedFiles.some((f) => f.path.endsWith('Cargo.lock'))) {
        issues.push({
          id: 'lockfile-missing-cargo',
          title: 'Cargo.lock missing',
          category: 'dependencies',
          severity: 'info',
          description: 'Cargo.lock was not found.',
          reason: 'For binary crates, committing Cargo.lock ensures reproducible builds.',
          recommendation: 'Run `cargo build` and commit Cargo.lock for binaries.',
          affectedFile: 'Cargo.toml',
          detected: 'no lockfile',
          expected: 'Cargo.lock',
          impact: 'Builds may not be reproducible.',
          suggestedAction: 'Commit Cargo.lock for binary projects.',
        });
      }
      return issues;
    },
  },
  {
    id: 'go-sum-present',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.packageManager !== 'go-modules') return issues;
      if (!ctx.detectedFiles.some((f) => f.path.endsWith('go.sum'))) {
        issues.push({
          id: 'go-sum-missing',
          title: 'go.sum missing',
          category: 'dependencies',
          severity: 'warning',
          description: 'go.sum was not found alongside go.mod.',
          reason: 'go.sum provides cryptographic checksums for module integrity.',
          recommendation: 'Run `go mod tidy` to generate go.sum.',
          affectedFile: 'go.mod',
          detected: 'no checksums',
          expected: 'go.sum',
          impact: 'Module integrity cannot be verified.',
          suggestedAction: 'Run go mod tidy.',
        });
      }
      return issues;
    },
  },
  {
    id: 'composer-lock-present',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.packageManager !== 'composer') return issues;
      if (!ctx.detectedFiles.some((f) => f.path.endsWith('composer.lock'))) {
        issues.push({
          id: 'composer-lock-missing',
          title: 'composer.lock missing',
          category: 'dependencies',
          severity: 'warning',
          description: 'composer.lock was not found.',
          reason: 'The lockfile ensures exact dependency versions in production.',
          recommendation: 'Run `composer install` and commit composer.lock.',
          affectedFile: 'composer.json',
          detected: 'no lockfile',
          expected: 'composer.lock',
          impact: 'Production deployments may install different versions.',
          suggestedAction: 'Commit composer.lock.',
        });
      }
      return issues;
    },
  },
  {
    id: 'gemfile-lock-present',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.packageManager !== 'bundler') return issues;
      if (!ctx.detectedFiles.some((f) => f.path.endsWith('Gemfile.lock'))) {
        issues.push({
          id: 'gemfile-lock-missing',
          title: 'Gemfile.lock missing',
          category: 'dependencies',
          severity: 'warning',
          description: 'Gemfile.lock was not found.',
          reason: 'The lockfile pins exact gem versions for reproducibility.',
          recommendation: 'Run `bundle install` and commit Gemfile.lock.',
          affectedFile: 'Gemfile',
          detected: 'no lockfile',
          expected: 'Gemfile.lock',
          impact: 'Gem versions may differ across machines.',
          suggestedAction: 'Commit Gemfile.lock.',
        });
      }
      return issues;
    },
  },
  {
    id: 'mix-lock-present',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.packageManager !== 'mix') return issues;
      if (!ctx.detectedFiles.some((f) => f.path.endsWith('mix.lock'))) {
        issues.push({
          id: 'mix-lock-missing',
          title: 'mix.lock missing',
          category: 'dependencies',
          severity: 'warning',
          description: 'mix.lock was not found.',
          reason: 'The lockfile pins exact Hex package versions.',
          recommendation: 'Run `mix deps.get` and commit mix.lock.',
          affectedFile: 'mix.exs',
          detected: 'no lockfile',
          expected: 'mix.lock',
          impact: 'Dependency versions may drift.',
          suggestedAction: 'Commit mix.lock.',
        });
      }
      return issues;
    },
  },
  {
    id: 'pubspec-lock-present',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.packageManager !== 'pub') return issues;
      if (!ctx.detectedFiles.some((f) => f.path.endsWith('pubspec.lock'))) {
        issues.push({
          id: 'pubspec-lock-missing',
          title: 'pubspec.lock missing',
          category: 'dependencies',
          severity: 'info',
          description: 'pubspec.lock was not found.',
          reason: 'The lockfile ensures consistent package versions.',
          recommendation: 'Run `flutter pub get` and commit pubspec.lock for apps.',
          affectedFile: 'pubspec.yaml',
          detected: 'no lockfile',
          expected: 'pubspec.lock',
          impact: 'Package versions may differ across machines.',
          suggestedAction: 'Commit pubspec.lock for application projects.',
        });
      }
      return issues;
    },
  },
  {
    id: 'package-json-scripts-present',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        if (!p.scripts || Object.keys(p.scripts).length === 0) {
          issues.push({
            id: 'npm-scripts-missing',
            title: 'No npm scripts defined in package.json',
            category: 'dependencies',
            severity: 'info',
            description: 'package.json has no scripts section or it is empty.',
            reason: 'Scripts standardize build, test, and dev commands.',
            recommendation: 'Add scripts for build, test, dev, and lint.',
            affectedFile: 'package.json',
            detected: 'no scripts',
            expected: 'at least dev/build/test',
            impact: 'No standard way to run the project.',
            suggestedAction: 'Add scripts to package.json.',
          });
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'package-json-name-present',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        if (!p.name || typeof p.name !== 'string') {
          issues.push({
            id: 'npm-name-missing',
            title: 'package.json missing name field',
            category: 'dependencies',
            severity: 'info',
            description: 'package.json does not declare a name.',
            reason: 'The name field is required for npm publishing and tooling.',
            recommendation: 'Add a "name" field to package.json.',
            affectedFile: 'package.json',
            detected: 'missing',
            expected: 'name field',
            impact: 'Publishing and some tools may fail.',
            suggestedAction: 'Add a name to package.json.',
          });
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'package-json-version-present',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        if (!p.version || typeof p.version !== 'string') {
          issues.push({
            id: 'npm-version-missing',
            title: 'package.json missing version field',
            category: 'dependencies',
            severity: 'info',
            description: 'package.json does not declare a version.',
            reason: 'The version field is required for npm publishing.',
            recommendation: 'Add a "version" field to package.json.',
            affectedFile: 'package.json',
            detected: 'missing',
            expected: 'version field',
            impact: 'Publishing will fail without a version.',
            suggestedAction: 'Add a version to package.json.',
          });
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'package-json-license-present',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        if (!p.license) {
          issues.push({
            id: 'npm-license-missing',
            title: 'package.json missing license field',
            category: 'dependencies',
            severity: 'info',
            description: 'package.json does not declare a license.',
            reason: 'A license field clarifies usage rights.',
            recommendation: 'Add a "license" field (e.g. "MIT").',
            affectedFile: 'package.json',
            detected: 'missing',
            expected: 'license field',
            impact: 'Legal clarity is reduced.',
            suggestedAction: 'Add a license to package.json.',
          });
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'cargo-toml-name-version',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      const cargo = readFile(ctx, 'Cargo.toml');
      if (!cargo) return issues;
      if (!/name\s*=/.test(cargo)) {
        issues.push({
          id: 'cargo-name-missing',
          title: 'Cargo.toml missing package name',
          category: 'dependencies',
          severity: 'warning',
          description: 'Cargo.toml does not declare a package name.',
          reason: 'The name field is required for publishing to crates.io.',
          recommendation: 'Add name = "my-crate" under [package].',
          affectedFile: 'Cargo.toml',
          detected: 'missing',
          expected: 'name field',
          impact: 'The crate cannot be published.',
          suggestedAction: 'Add a name to Cargo.toml.',
        });
      }
      if (!/version\s*=/.test(cargo)) {
        issues.push({
          id: 'cargo-version-missing',
          title: 'Cargo.toml missing package version',
          category: 'dependencies',
          severity: 'warning',
          description: 'Cargo.toml does not declare a package version.',
          reason: 'The version field is required for publishing.',
          recommendation: 'Add version = "0.1.0" under [package].',
          affectedFile: 'Cargo.toml',
          detected: 'missing',
          expected: 'version field',
          impact: 'The crate cannot be published.',
          suggestedAction: 'Add a version to Cargo.toml.',
        });
      }
      return issues;
    },
  },
  {
    id: 'cargo-toml-license',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      const cargo = readFile(ctx, 'Cargo.toml');
      if (!cargo) return issues;
      if (!/license\s*=/.test(cargo)) {
        issues.push({
          id: 'cargo-license-missing',
          title: 'Cargo.toml missing license field',
          category: 'dependencies',
          severity: 'info',
          description: 'Cargo.toml does not declare a license.',
          reason: 'A license clarifies usage rights.',
          recommendation: 'Add license = "MIT" under [package].',
          affectedFile: 'Cargo.toml',
          detected: 'missing',
          expected: 'license field',
          impact: 'Legal clarity is reduced.',
          suggestedAction: 'Add a license to Cargo.toml.',
        });
      }
      return issues;
    },
  },
  {
    id: 'go-mod-go-directive',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      const gomod = readFile(ctx, 'go.mod');
      if (!gomod) return issues;
      const m = gomod.match(/^go\s+(\d+)\.(\d+)/m);
      if (m) {
        const major = Number(m[1]);
        const minor = Number(m[2]);
        if (major === 1 && minor < 20) {
          issues.push({
            id: 'go-version-outdated',
            title: 'go.mod declares an outdated Go version',
            category: 'dependencies',
            severity: 'warning',
            description: `go.mod targets Go ${major}.${minor}.`,
            reason: 'Go 1.19 and below are no longer actively supported.',
            recommendation: 'Bump the go directive to 1.22 or newer.',
            affectedFile: 'go.mod',
            detected: `go ${major}.${minor}`,
            expected: 'go 1.22+',
            impact: 'Missing language features and security fixes.',
            suggestedAction: 'Update the go directive in go.mod.',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'pyproject-build-system',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.language !== 'Python') return issues;
      const pyproject = readFile(ctx, 'pyproject.toml');
      if (!pyproject) return issues;
      if (!/\[build-system\]/i.test(pyproject)) {
        issues.push({
          id: 'pyproject-build-system-missing',
          title: 'pyproject.toml missing [build-system] section',
          category: 'dependencies',
          severity: 'info',
          description: 'pyproject.toml does not declare a build-system.',
          reason: 'Build backends like hatchling, setuptools, or poetry need this section.',
          recommendation: 'Add a [build-system] section with requires and build-backend.',
          affectedFile: 'pyproject.toml',
          detected: 'missing',
          expected: '[build-system] section',
          impact: 'The project may not build with standard tools.',
          suggestedAction: 'Add [build-system] to pyproject.toml.',
        });
      }
      return issues;
    },
  },
  {
    id: 'requirements-frozen',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      const req = readFile(ctx, 'requirements.txt');
      if (!req) return issues;
      const lines = req.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
      let exactPinned = 0;
      let totalDeps = 0;
      for (const line of lines) {
        const name = line.split(/[<>=!\s~]/)[0];
        if (!name) continue;
        totalDeps++;
        if (/==\d/.test(line)) exactPinned++;
      }
      if (totalDeps > 0 && exactPinned / totalDeps < 0.5) {
        issues.push({
          id: 'requirements-not-frozen',
          title: 'Most requirements are not exact-pinned',
          category: 'dependencies',
          severity: 'warning',
          description: `${exactPinned}/${totalDeps} requirements use exact pinning (==).`,
          reason: 'Exact pinning ensures reproducible installs.',
          recommendation: 'Use pip-compile or pip freeze to generate exact pins.',
          affectedFile: 'requirements.txt',
          detected: `${exactPinned}/${totalDeps} pinned`,
          expected: 'all pinned with ==',
          impact: 'Installs may not be reproducible.',
          suggestedAction: 'Pin all requirements with ==.',
        });
      }
      return issues;
    },
  },
  {
    id: 'deps-typescript-version',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.language !== 'TypeScript') return issues;
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        const allDeps = { ...(p.devDependencies ?? {}), ...(p.dependencies ?? {}) } as Record<string, string>;
        const tsRange = allDeps['typescript'];
        if (tsRange) {
          const m = tsRange.match(/(\d+)/);
          if (m && Number(m[1]) < 5) {
            issues.push({
              id: 'typescript-outdated',
              title: 'TypeScript is on an older major version',
              category: 'dependencies',
              severity: 'warning',
              description: `typescript is declared as "${tsRange}".`,
              reason: 'TypeScript 5+ includes performance and feature improvements.',
              recommendation: 'Upgrade typescript to ^5.0.0.',
              affectedFile: 'package.json',
              detected: tsRange,
              expected: '^5.0.0',
              impact: 'Missing modern TS features and faster compilation.',
              suggestedAction: 'npm install -D typescript@^5.0.0',
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
    id: 'deps-vite-version',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        const allDeps = { ...(p.devDependencies ?? {}), ...(p.dependencies ?? {}) } as Record<string, string>;
        const viteRange = allDeps['vite'];
        if (viteRange) {
          const m = viteRange.match(/(\d+)/);
          if (m && Number(m[1]) < 5) {
            issues.push({
              id: 'vite-outdated',
              title: 'Vite is on an older major version',
              category: 'dependencies',
              severity: 'info',
              description: `vite is declared as "${viteRange}".`,
              reason: 'Vite 5+ includes Rollup 4 and performance improvements.',
              recommendation: 'Upgrade vite to ^5.0.0.',
              affectedFile: 'package.json',
              detected: viteRange,
              expected: '^5.0.0',
              impact: 'Missing build performance improvements.',
              suggestedAction: 'npm install -D vite@^5.0.0',
            });
          }
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
];
