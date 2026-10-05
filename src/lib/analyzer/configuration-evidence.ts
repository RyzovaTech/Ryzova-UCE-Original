import { normalizeProjectPath, classifyProjectFileScope } from './project-scope';
export const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function jsonObject(source: string | undefined): Record<string, unknown> | undefined {
  try { const value: unknown = JSON.parse(source ?? ''); return isRecord(value) ? value : undefined; } catch { return undefined; }
}
export function evidenceScope(path: string): boolean { return ['production', 'configuration'].includes(classifyProjectFileScope(path)); }
export function packageDirectory(path: string): string { return normalizeProjectPath(path).split('/').slice(0, -1).join('/'); }
/** JSONC is accepted only for TypeScript configuration; scanned code is never run. */
export function typescriptConfig(source: string | undefined): Record<string, unknown> | undefined {
  if (!source) return undefined;
  const chars = source.split(''); let quoted = false;
  for (let i = 0; i < chars.length; i++) {
    if (quoted) { if (source[i] === '\\') i++; else if (source[i] === '"') quoted = false; continue; }
    if (source[i] === '"') { quoted = true; continue; }
    if (source.slice(i, i + 2) === '//') { while (i < chars.length && source[i] !== '\n') chars[i++] = ' '; i--; }
    else if (source.slice(i, i + 2) === '/*') {
      const end = source.indexOf('*/', i + 2); if (end < 0) return undefined;
      for (; i < end + 2; i++) if (source[i] !== '\n' && source[i] !== '\r') chars[i] = ' '; i--;
    }
  }
  quoted = false;
  for (let i = 0; i < chars.length; i++) {
    if (quoted) { if (chars[i] === '\\') i++; else if (chars[i] === '"') quoted = false; continue; }
    if (chars[i] === '"') quoted = true;
    else if (chars[i] === ',') { let next = i + 1; while (next < chars.length && /\s/.test(chars[next])) next++; if (chars[next] === '}' || chars[next] === ']') chars[i] = ' '; }
  }
  return jsonObject(chars.join(''));
}
