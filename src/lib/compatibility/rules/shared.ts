import type { ProjectFile } from '../../analyzer/types';
import type { RuleContext } from '../types';

export function readFile(ctx: RuleContext, target: string): string | null {
  const files = ctx.files;
  let file = files.find((f) => f.path === target);
  if (!file) file = files.find((f) => f.path.endsWith('/' + target));
  if (!file || file.isDirectory) return null;
  return (file as ProjectFile & { content?: string }).content ?? null;
}
