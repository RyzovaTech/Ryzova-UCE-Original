import type { ProjectFile } from './types';
import { normalizeProjectPath } from './project-scope';

export interface PackageDeclaration { name: string; file: string; identity: boolean; version?: string; }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const PACKAGE = /^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*$/i;

/** Read declarations without executing package managers or scanned code. */
export function npmDeclarations(files: ProjectFile[]): PackageDeclaration[] {
  const declarations: PackageDeclaration[] = [];
  for (const file of files) {
    if (!/(^|\/)package\.json$/i.test(file.path) || !file.content) continue;
    try {
      const data: unknown = JSON.parse(file.content);
      if (!object(data)) continue;
      const path = normalizeProjectPath(file.path);
      if (typeof data.name === 'string' && PACKAGE.test(data.name) && typeof data.version === 'string' && /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(data.version))
        declarations.push({ name: data.name, file: path, identity: true, version: data.version });
      for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
        const values = data[section];
        if (!object(values)) continue;
        for (const [name, version] of Object.entries(values)) {
          if (PACKAGE.test(name) && typeof version === 'string' && version.trim()) declarations.push({ name, file: path, identity: false, version });
        }
      }
    } catch { /* Invalid JSON cannot establish dependency or package identity. */ }
  }
  return declarations;
}

export function hasDotnetSdk(source: string): boolean {
  try {
    const data: unknown = JSON.parse(source);
    return object(data) && object(data.sdk) && typeof data.sdk.version === 'string' && /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(data.sdk.version);
  } catch { return false; }
}

/** A Flutter SDK mapping in an actual dependency block, not prose or a package name. */
export function hasFlutterSdk(source: string): boolean {
  let section = false, dependencyIndent: number | undefined;
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '');
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (/^(?:dependencies|dev_dependencies):\s*$/.test(line)) { section = true; dependencyIndent = undefined; continue; }
    if (/^\S/.test(line)) { section = false; dependencyIndent = undefined; }
    if (!section) continue;
    const indent = line.length - line.trimStart().length;
    if (/^\s+[\w-]+:\s*(?:#.*)?$/.test(line)) { dependencyIndent = indent; continue; }
    if (dependencyIndent !== undefined && indent > dependencyIndent && /^\s+sdk:\s*['"]?flutter['"]?\s*$/.test(line)) return true;
    if (dependencyIndent !== undefined && indent <= dependencyIndent) dependencyIndent = undefined;
  }
  return false;
}

/** Lock entries corroborate declarations in the same package; they never invent a stack. */
export function npmLockCorroborates(files: ProjectFile[], declaration: PackageDeclaration): string | undefined {
  if (declaration.identity) return undefined;
  const directory = declaration.file.slice(0, -'package.json'.length);
  const lock = files.find(file => normalizeProjectPath(file.path) === directory + 'package-lock.json');
  if (!lock?.content) return undefined;
  try {
    const data: unknown = JSON.parse(lock.content);
    if (!object(data)) return undefined;
    if (object(data.packages)) {
      const entry = data.packages['node_modules/' + declaration.name];
      const root = data.packages[''];
      if (!object(root) || !['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'].some(section =>
        object(root[section]) && root[section][declaration.name] === declaration.version)) return undefined;
      if (object(entry) && typeof entry.version === 'string' && /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(entry.version)) {
        if (declaration.version && /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(declaration.version) && declaration.version !== entry.version) return undefined;
        return normalizeProjectPath(lock.path);
      }
    }
  } catch { /* Malformed locks provide no corroboration. */ }
  return undefined;
}

/** Preserve ordinary scalar declarations but mask TOML comments and multiline prose. */
function tomlDeclarationText(source: string): string {
  const out = source.split(''); let quote = ''; let multiline = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (multiline) {
        if (source.slice(i, i + 3) === quote.repeat(3)) {
          out[i] = out[i + 1] = out[i + 2] = ' '; i += 2; quote = ''; multiline = false;
        } else if (char !== '\n' && char !== '\r') out[i] = ' ';
      } else if (char === '\\' && quote === '"') i++;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '#') {
      while (i < source.length && source[i] !== '\n') out[i++] = ' ';
      i--; continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      if (source.slice(i, i + 3) === char.repeat(3)) {
        multiline = true; out[i] = out[i + 1] = out[i + 2] = ' '; i += 2;
      }
    }
  }
  return out.join('');
}

/** Table-scoped package identity is evidence of a framework's own implementation. */
export function ecosystemIdentities(files: ProjectFile[]): Array<{ ecosystem: 'python' | 'cargo' | 'go' | 'composer'; name: string; file: string }> {
  const result: Array<{ ecosystem: 'python' | 'cargo' | 'go' | 'composer'; name: string; file: string }> = [];
  for (const file of files) {
    if (!file.content) continue;
    const path = normalizeProjectPath(file.path), base = path.split('/').pop();
    if (base === 'pyproject.toml' || base === 'Cargo.toml') {
      let section = '';
      for (const line of tomlDeclarationText(file.content).split(/\r?\n/)) {
        const header = /^\s*\[([^\]]+)\]\s*(?:#.*)?$/.exec(line);
        if (header) { section = header[1]; continue; }
        if (section !== (base === 'Cargo.toml' ? 'package' : 'project')) continue;
        const match = /^\s*name\s*=\s*["']([A-Za-z0-9][A-Za-z0-9._-]*)["']\s*(?:#.*)?$/.exec(line);
        if (match) result.push({ ecosystem: base === 'Cargo.toml' ? 'cargo' : 'python', name: base === 'Cargo.toml' ? match[1] : match[1].toLowerCase().replace(/[-_.]+/g, '-'), file: path });
      }
    } else if (base === 'go.mod') {
      const match = /^\s*module\s+([\w./-]+)\s*(?:\/\/.*)?$/m.exec(file.content);
      if (match) result.push({ ecosystem: 'go', name: match[1], file: path });
    } else if (base === 'composer.json') {
      try {
        const data: unknown = JSON.parse(file.content);
        if (object(data) && typeof data.name === 'string' && /^[\w.-]+\/[\w.-]+$/.test(data.name)) result.push({ ecosystem: 'composer', name: data.name, file: path });
      } catch { /* Invalid package identity is not evidence. */ }
    }
  }
  return result;
}
