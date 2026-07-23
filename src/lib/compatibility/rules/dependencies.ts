import type { CompatibilityRule } from '../types';
import type { Issue } from '../../analyzer/types';
import { readFile } from './shared';

interface ParsedDep {
  name: string;
  range: string;
  kind: 'dependencies' | 'devDependencies' | 'peerDependencies';
}

function parsePackageJson(content: string): ParsedDep[] {
  try {
    const pkg = JSON.parse(content);
    const out: ParsedDep[] = [];
    for (const kind of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
      const block = pkg[kind];
      if (block && typeof block === 'object') {
        for (const [name, range] of Object.entries(block)) {
          out.push({ name, range: String(range), kind });
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

const OUTDATED_HINTS: Record<string, string> = {
  react: '18',
  'react-dom': '18',
  next: '14',
  vue: '3',
  '@sveltejs/kit': '2',
  typescript: '5',
  vite: '5',
  tailwindcss: '3',
};

function majorOf(range: string): number | null {
  const m = range.match(/\d+/);
  return m ? Number(m[0]) : null;
}

export const dependencyRules: CompatibilityRule[] = [
  {
    id: 'lockfile-present',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.packageManager === 'npm') {
        if (!ctx.detectedFiles.some((f) => f.path.endsWith('package-lock.json'))) {
          issues.push({
            id: 'lockfile-missing-npm',
            title: 'npm lockfile missing',
            category: 'dependencies',
            severity: 'warning',
            description: 'package-lock.json was not found in the uploaded project.',
            reason: 'Without a lockfile, dependency resolution is non-deterministic across installs.',
            recommendation: 'Run `npm install` and commit the generated package-lock.json.',
            affectedFile: 'package.json',
            detected: 'no lockfile',
            expected: 'package-lock.json',
            impact: 'Different versions may be installed in CI vs. local, causing drift.',
            suggestedAction: 'Commit package-lock.json to the repository.',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'outdated-major-dependencies',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      const deps = parsePackageJson(pkg);
      for (const dep of deps) {
        const expected = OUTDATED_HINTS[dep.name];
        if (!expected) continue;
        const requiredMajor = Number(expected);
        const actualMajor = majorOf(dep.range);
        if (actualMajor !== null && actualMajor < requiredMajor) {
          issues.push({
            id: `outdated-${dep.name}`,
            title: `${dep.name} is on an older major version`,
            category: 'dependencies',
            severity: 'warning',
            description: `${dep.name} is declared as "${dep.range}" in ${dep.kind}.`,
            reason: `${dep.name} ${requiredMajor}+ is the current stable line; older majors miss fixes and features.`,
            recommendation: `Upgrade ${dep.name} to ^${requiredMajor}.0.0 and run the test suite.`,
            affectedFile: 'package.json',
            detected: dep.range,
            expected: `^${requiredMajor}.0.0`,
            impact: 'Missing security patches and modern APIs.',
            suggestedAction: `npm install ${dep.name}@^${requiredMajor}.0.0`,
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'duplicate-dependency',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      const deps = parsePackageJson(pkg);
      const seen = new Map<string, ParsedDep>();
      for (const dep of deps) {
        const prev = seen.get(dep.name);
        if (prev && prev.range !== dep.range) {
          issues.push({
            id: `dup-${dep.name}`,
            title: `${dep.name} declared with conflicting versions`,
            category: 'dependencies',
            severity: 'info',
            description: `${dep.name} appears in ${prev.kind} (${prev.range}) and ${dep.kind} (${dep.range}).`,
            reason: 'Conflicting ranges across dependency sections can resolve to unexpected versions.',
            recommendation: 'Align the version ranges for this package across all sections.',
            affectedFile: 'package.json',
            detected: `${prev.range} / ${dep.range}`,
            expected: 'single range',
            impact: 'Hoisting may pick the wrong version at runtime.',
            suggestedAction: 'Unify the version range for this dependency.',
          });
        }
        seen.set(dep.name, dep);
      }
      return issues;
    },
  },
  {
    id: 'python-requirements-unpinned',
    category: 'dependencies',
    run: (ctx) => {
      const issues: Issue[] = [];
      const req = readFile(ctx, 'requirements.txt');
      if (!req) return issues;
      const lines = req.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
      for (const line of lines) {
        if (/^[a-zA-Z0-9_.-]+\s*$/.test(line) || />=\s*$/.test(line)) {
          issues.push({
            id: `unpinned-${line.split(/[<>=!\s]/)[0]}`,
            title: 'Python dependency is not version-pinned',
            category: 'dependencies',
            severity: 'warning',
            description: `Requirement "${line}" does not pin a specific version.`,
            reason: 'Unpinned requirements resolve to the latest release and may break without notice.',
            recommendation: 'Pin the requirement to a compatible version range.',
            affectedFile: 'requirements.txt',
            detected: line,
            expected: 'package==X.Y.Z',
            impact: 'Reproducible installs are not guaranteed.',
            suggestedAction: 'Pin the version, e.g. package==1.2.3.',
          });
        }
      }
      return issues;
    },
  },
];
