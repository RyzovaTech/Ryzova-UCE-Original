import { isProjectEvidenceFile } from '../../analyzer/project-scope';
import { versionRangesDisjoint } from '../../analyzer/version-constraints';
import { pythonVersionRequirement } from '../../analyzer/python-evidence';
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
          recommendation: 'Add an "engines.node" field matching your minimum supported Node version after testing on a maintained release.',
          affectedFile: 'package.json',
          detected: 'not declared',
          expected: 'a maintained Node release',
          impact: 'Runtime drift across environments can cause build or runtime failures.',
          suggestedAction: 'Declare the tested Node compatibility range in package.json.',
        });
        return issues;
      }
      // 2026-10-13 release snapshot: 22/24 maintained; 26+ is current or unknown future.
      // A lower bound is not the selected runtime. Unknown syntax is not an EOL finding.
      if (versionRangesDisjoint(required, '22 || 24 || >=26') === true) {
        issues.push({
          id: 'node-engine-outdated',
          title: 'Node.js engine range excludes maintained release lines',
          category: 'runtime',
          severity: 'warning',
          description: `Declared Node engine "${required}" permits only release lines known to be end-of-life in the 2026-10-13 release snapshot.`,
          reason: 'The declared compatibility range excludes maintained releases; it does not establish which runtime is deployed.',
          recommendation: 'Test compatibility with a maintained Node release and update the engine range accordingly.',
          affectedFile: 'package.json',
          detected: required,
          expected: 'a maintained Node release',
          impact: 'Consumers following this range may select an unsupported runtime.',
          suggestedAction: 'Test and declare support for a maintained Node release.',
        });
      }
      return issues;
    },
  },
  {
    id: 'node-selected-runtime-eol',
    category: 'runtime',
    run: ctx => {
      const issues: Issue[] = [];
      for (const file of ctx.files.filter(f => isProjectEvidenceFile(f) && /(?:^|\/)(?:\.nvmrc|\.node-version)$/.test(f.path))) {
        const value = (file.content ?? '').split(/\r?\n/).map(line => line.replace(/#.*$/, '').trim()).filter(Boolean).join(' ');
        const match = /^v?(\d+)(?:\.\d+){0,2}$/.exec(value);
        if (!match) continue;
        const major = Number(match[1]);
        if (!(major === 0 || (major >= 4 && major < 26 && ![22, 24].includes(major)))) continue;
        issues.push({ id: `node-selected-runtime-eol:${file.path}`, title: 'Node version file selects an end-of-life release',
          category: 'runtime', severity: 'warning', affectedFile: file.path, detected: value, expected: 'a maintained Node release',
          description: `${file.path} selects Node ${major}, end-of-life in the 2026-10-13 release snapshot.`,
          reason: 'This version file selects a runtime rather than merely declaring a minimum compatibility range.',
          recommendation: 'Test with a maintained Node release and update the selected version.',
          impact: 'Environments honoring this file may use an unmaintained runtime.' });
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
        !!pythonVersionRequirement(pyproject ?? '');
      const hasSetupRequires =
        !!setupPy && /python_requires\s*=\s*['"][^'"]+['"]/.test(setupPy);
      const setupCfg = readFile(ctx, 'setup.cfg') ?? '';
      const hasRuntimePin = !!runtimeTxt?.trim() || !!pythonVersion?.trim() || /^\s*python_requires\s*=\s*\S+/m.test(setupCfg);
      if (hasPyprojectRequires || hasSetupRequires || hasRuntimePin) return issues;
      issues.push({
        id: 'python-version-missing',
        title: 'Python version requirement not declared',
        category: 'runtime',
        severity: 'warning',
        description: 'No Python version declaration recognized in project metadata or runtime version files.',
        reason: 'Python 3.8 is end-of-life; without a constraint, older interpreters may be used.',
        recommendation: 'Declare requires-python under [project] in pyproject.toml using the versions you support.',
        affectedFile: pyproject ? 'pyproject.toml' : 'setup.py',
        detected: 'not declared',
        expected: '>=3.11',
        impact: 'Incompatible syntax or missing stdlib features on older interpreters.',
        suggestedAction: 'Declare project.requires-python in pyproject.toml.',
      });
      return issues;
    },
  },
  {
    id: 'dockerfile-runtime-detected',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      for (const docker of ctx.files.filter(f => isProjectEvidenceFile(f) && /(?:^|\/)Dockerfile$/.test(f.path))) {
        if (!docker.content) continue;
        const stages = docker.content.split(/\r?\n/).flatMap((line, index) => {
          const m = /^\s*FROM\s+(?:--platform=\S+\s+)?(?:docker\.io\/(?:library\/)?)?node:(\d+)(?:\.\d+){0,2}(?:-[\w.-]+)?(?:@sha256:[a-f0-9]{64})?(?:\s+AS\s+[\w.-]+)?\s*(?:#.*)?$/i.exec(line);
          return m ? [{ major: Number(m[1]), line: index + 1 }] : [];
        });
        for (const stage of stages.filter(s => s.major < 26 && ![22, 24].includes(s.major))) {
          issues.push({
            id: `docker-node-outdated:${docker.path}:${stage.line}`,
            title: 'Docker build stage selects an end-of-life Node release',
            category: 'runtime', severity: 'warning', affectedFile: docker.path,
            description: `${docker.path}:${stage.line} selects Node ${stage.major}, end-of-life in the 2026-10-13 release snapshot.`,
            reason: 'This explicit build-stage selection has no upstream maintenance; it may be a build stage rather than the final deployed runtime.',
            recommendation: 'Test the stage on a maintained Node release before updating its image.',
            detected: `node:${stage.major}`, expected: 'a maintained Node release',
            impact: 'Build tooling or application code may run on an unmaintained runtime.',
            suggestedAction: 'Review this FROM instruction and its stage usage.',
          });
        }
      }
      return issues;
    },
  },
];
