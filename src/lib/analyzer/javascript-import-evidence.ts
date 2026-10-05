import { parse } from 'acorn';
import type { ProjectFile } from './types';
import { normalizeProjectPath } from './project-scope';

interface SyntaxNode { type: string; source?: SyntaxNode; value?: unknown; [key: string]: unknown; }
export interface ImportEvidence { name: string; file: string; }
const isNode = (value: unknown): value is SyntaxNode => !!value && typeof value === 'object' && 'type' in value;

/** Parse literal ES imports/re-exports. Never execute source or resolve remote modules. */
export function javascriptImportEvidence(files: ProjectFile[]): ImportEvidence[] {
  const result: ImportEvidence[] = [];
  for (const file of files) {
    // Unsupported syntax and oversized files supply no AST evidence. Manifests still apply.
    if (!/\.(?:js|mjs|cjs)$/i.test(file.path) || !file.content || file.content.length > 256 * 1024) continue;
    // Avoid building an AST when there cannot be import/export evidence.
    if (!/\b(?:import|export)\b/.test(file.content)) continue;
    try {
      const root = parse(file.content, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true });
      const pending: SyntaxNode[] = [root as unknown as SyntaxNode];
      const names = new Set<string>(); let visited = 0;
      while (pending.length && visited++ < 50_000) {
        const node = pending.pop()!;
        if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration', 'ImportExpression'].includes(node.type) && node.source?.type === 'Literal' && typeof node.source.value === 'string') {
          const specifier = node.source.value;
          if (/^(?:@[\w.-]+\/)?[\w-]+(?:\/|$)/.test(specifier)) {
            const parts = specifier.split('/');
            names.add(specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]);
          }
        }
        for (const value of Object.values(node)) {
          if (isNode(value)) pending.push(value);
          else if (Array.isArray(value)) for (const child of value) if (isNode(child)) pending.push(child);
        }
      }
      // An incomplete walk must not produce apparently complete AST evidence.
      if (!pending.length) for (const name of names) result.push({ name, file: normalizeProjectPath(file.path) });
    } catch { /* Invalid/unsupported JavaScript supplies no import evidence. */ }
  }
  return result;
}

/** Closest package boundary, including packages with invalid or missing metadata. */
export function packageOwner(file: string, manifests: string[]): string {
  let owner = '';
  for (const manifest of manifests) {
    const directory = manifest.slice(0, manifest.lastIndexOf('/') + 1);
    if (file.startsWith(directory) && directory.length > owner.length) owner = directory;
  }
  return owner;
}
