import type { ProjectFile } from './types';
import { isRecord, typescriptConfig, packageDirectory } from './configuration-evidence';
import { normalizeProjectPath } from './project-scope';
/** Resolve bounded relative JSONC inheritance without running scanned code. */
export function resolveTypeScriptOptions(files: ProjectFile[], path: string, seen = new Set<string>()): { options: Record<string, unknown>; complete: boolean; solution: boolean } {
  const unknown = { options: {}, complete: false, solution: false };
  path = normalizeProjectPath(path);
  if (seen.has(path) || seen.size >= 16) return unknown;
  const next = new Set(seen); next.add(path);
  const data = typescriptConfig(files.find(f => normalizeProjectPath(f.path) === path)?.content);
  if (!data) return unknown;
  let options: Record<string, unknown> = {}, complete = true;
  const bases = data.extends === undefined ? [] : Array.isArray(data.extends) ? data.extends : [data.extends];
  for (const base of bases) {
    if (typeof base !== 'string' || !base.startsWith('.') || base.includes('\\')) { complete = false; options = {}; continue; }
    const parts = packageDirectory(path).split('/').filter(Boolean); let valid = true;
    for (const part of base.split('/')) {
      if (part === '..') { if (!parts.length) { valid = false; break; } parts.pop(); }
      else if (part && part !== '.') parts.push(part);
    }
    if (!valid) { complete = false; options = {}; continue; }
    const raw = parts.join('/');
    const target = [raw, raw + '.json'].find(candidate => files.some(f => normalizeProjectPath(f.path) === candidate));
    const inherited = target ? resolveTypeScriptOptions(files, target, next) : unknown;
    // Unknown later bases may override every earlier option.
    if (!inherited.complete) options = {};
    options = { ...options, ...inherited.options }; complete = complete && inherited.complete;
  }
  if (data.compilerOptions !== undefined && !isRecord(data.compilerOptions)) return unknown;
  options = { ...options, ...(isRecord(data.compilerOptions) ? data.compilerOptions : {}) };
  return { options, complete, solution: Array.isArray(data.references) && data.references.length > 0 && Array.isArray(data.files) && data.files.length === 0 && !data.include };
}
