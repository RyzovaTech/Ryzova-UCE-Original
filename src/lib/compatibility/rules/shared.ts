import type { ProjectFile } from '../../analyzer/types';
import type { RuleContext } from '../types';
import { classifyProjectFileScope } from '../../analyzer/project-scope';

/** Ignore auxiliary manifests when choosing primary compatibility evidence. */
export function findEvidenceFile(ctx: RuleContext, target: string): ProjectFile | undefined {
  const documentationTarget = classifyProjectFileScope(target) === 'documentation';
  return ctx.files.filter(file => {
    if (file.isDirectory || !(file.path === target || file.path.endsWith('/' + target))) return false;
    const scope = classifyProjectFileScope(file.path);
    return scope === 'production' || scope === 'configuration' || (documentationTarget && scope === 'documentation');
  }).sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path))[0];
}

export function readFile(ctx: RuleContext, target: string): string | null {
  return findEvidenceFile(ctx, target)?.content ?? null;
}

export function hasEslintConfig(ctx: RuleContext): boolean {
  if (ctx.files.some(file => !file.isDirectory && ['production', 'configuration'].includes(classifyProjectFileScope(file.path)) &&
    /(?:^|\/)(?:\.eslintrc(?:\.(?:json|js|cjs|mjs|ya?ml))?|eslint\.config\.(?:js|mjs|cjs|ts|mts|cts))$/i.test(file.path))) return true;
  const content = readFile(ctx, 'package.json');
  if (!content) return false;
  try {
    const config = JSON.parse(content).eslintConfig;
    return Boolean(config && typeof config === 'object' && !Array.isArray(config));
  } catch { return false; }
}
