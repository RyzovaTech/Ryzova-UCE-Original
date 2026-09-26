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
