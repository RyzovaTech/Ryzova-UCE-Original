import type { CompatibilityRule } from '../types';
import type { Issue } from '../../analyzer/types';
import { readFile } from './shared';

function parseNodeVersion(content: string): string | null {
  try {
    const pkg = JSON.parse(content);
    const engines = pkg.engines?.node;
    if (engines) return String(engines);
  } catch {
    // ignore
  }
  return null;
}

export const runtimeRules: CompatibilityRule[] = [
  {
    id: 'node-engine-pinned',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.runtime !== 'Node.js') return issues;
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      const required = parseNodeVersion(pkg);
      if (!required) {
        issues.push({
          id: 'node-engine-missing',
          title: 'Node.js engine version not declared',
          category: 'runtime',
          severity: 'warning',
          description: 'package.json does not declare an engines.node constraint.',
          reason: 'Without an engine constraint, contributors may run an unsupported Node version.',
          recommendation: 'Add an "engines.node" field matching your minimum supported Node version (>=20 recommended).',
          affectedFile: 'package.json',
          detected: 'not declared',
          expected: '>=20',
          impact: 'Runtime drift across environments can cause build or runtime failures.',
          suggestedAction: 'Pin "engines.node": ">=20" in package.json.',
        });
        return issues;
      }
      const match = required.match(/(\d+)/);
      if (match && Number(match[1]) < 18) {
        issues.push({
          id: 'node-engine-outdated',
          title: 'Node.js engine version is below LTS',
          category: 'runtime',
          severity: 'critical',
          description: `Declared Node engine "${required}" is below the active LTS baseline.`,
          reason: 'Node 16 and below are end-of-life and no longer receive security updates.',
          recommendation: 'Upgrade the engine constraint to Node 20 LTS or newer.',
          affectedFile: 'package.json',
          detected: required,
          expected: '>=20',
          impact: 'Security patches and modern syntax support will be missing.',
          suggestedAction: 'Bump engines.node to ">=20" and test the build.',
        });
      }
      return issues;
    },
  },
  {
    id: 'python-version-pinned',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.runtime !== 'Python') return issues;
      const pyproject = readFile(ctx, 'pyproject.toml');
      const setupPy = readFile(ctx, 'setup.py');
      const runtimeTxt = readFile(ctx, 'runtime.txt');
      const pythonVersion = readFile(ctx, '.python-version');
      const hasPyprojectRequires =
        !!pyproject && /python_requires\s*=\s*['"][^'"]+['"]/.test(pyproject);
      const hasSetupRequires =
        !!setupPy && /python_requires\s*=\s*['"][^'"]+['"]/.test(setupPy);
      const hasRuntimePin = !!runtimeTxt || !!pythonVersion;
      if (hasPyprojectRequires || hasSetupRequires || hasRuntimePin) return issues;
      issues.push({
        id: 'python-version-missing',
        title: 'Python version requirement not declared',
        category: 'runtime',
        severity: 'warning',
        description: 'No python_requires found in pyproject.toml, setup.py, runtime.txt, or .python-version.',
        reason: 'Python 3.8 is end-of-life; without a constraint, older interpreters may be used.',
        recommendation: 'Add python_requires = ">=3.11" to pyproject.toml or a .python-version file.',
        affectedFile: pyproject ? 'pyproject.toml' : 'setup.py',
        detected: 'not declared',
        expected: '>=3.11',
        impact: 'Incompatible syntax or missing stdlib features on older interpreters.',
        suggestedAction: 'Declare python_requires in pyproject.toml.',
      });
      return issues;
    },
  },
  {
    id: 'dockerfile-runtime-detected',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      const docker = ctx.detectedFiles.find((f) => f.path.endsWith('Dockerfile'));
      if (!docker) return issues;
      const content = readFile(ctx, 'Dockerfile');
      if (!content) return issues;
      if (/FROM\s+node:\d+/.test(content)) {
        const m = content.match(/FROM\s+node:(\d+)/);
        const v = m ? Number(m[1]) : null;
        if (v && v < 20) {
          issues.push({
            id: 'docker-node-outdated',
            title: 'Dockerfile pins an outdated Node image',
            category: 'runtime',
            severity: 'warning',
            description: `Dockerfile uses node:${v} which is below the LTS baseline.`,
            reason: 'Running on an EOL Node image blocks security updates.',
            recommendation: 'Bump the base image to node:20 or newer.',
            affectedFile: 'Dockerfile',
            detected: `node:${v}`,
            expected: 'node:20+',
            impact: 'Container builds may inherit unpatched vulnerabilities.',
            suggestedAction: 'Update FROM node:20-alpine (or equivalent).',
          });
        }
      }
      return issues;
    },
  },
];
