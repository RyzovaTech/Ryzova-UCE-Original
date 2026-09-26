import { pythonDependencies } from './python-evidence';
import type { ProjectFile } from './types';
import { isProjectEvidenceFile, normalizeProjectPath } from './project-scope';

export type Ecosystem = 'python' | 'cargo' | 'go' | 'composer';
export interface EcosystemDependency { ecosystem: Ecosystem; name: string; file: string; version?: string; type?: 'runtime' | 'development' | 'optional'; }

/** Bounded, non-executing readers for common declaration forms, not full resolvers. */
export function collectEcosystemDependencies(files: ProjectFile[]): EcosystemDependency[] {
  const result: EcosystemDependency[] = [];
  for (const file of files.filter(isProjectEvidenceFile)) {
    if (!file.content) continue;
    const path = normalizeProjectPath(file.path);
    const base = path.split('/').pop() ?? path;
    const add = (ecosystem: Ecosystem, name: string, version?: string, type?: EcosystemDependency['type']) => result.push({ ecosystem, name, file: path, ...(version ? { version } : {}), ...(type ? { type } : {}) });
    if (/^requirements(?:[-_.][\w.-]+)?\.txt$/i.test(base)) {
      for (const raw of file.content.split(/\r?\n/)) {
        const line = raw.trim();
        // Ignore includes/options/URLs; do not fetch or execute them.
        const match = /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]+\])?\s*(?:[<>=!~;@]|$)/.exec(line);
        if (match) add('python', match[1].toLowerCase().replace(/[-_.]+/g, '-'));
      }
    } else if (base === 'pyproject.toml') {
      for (const item of pythonDependencies(file.content)) add('python', item.name);
      let poetrySection = false;
      for (const raw of file.content.split(/\r?\n/)) {
        const line = raw.trim();
        const header = /^\[([^\]]+)\]$/.exec(line);
        if (header) { poetrySection = /^tool\.poetry(?:\.group\.[^.]+)?\.dependencies$/.test(header[1]); continue; }
        if (!poetrySection || line.startsWith('#')) continue;
        const entry = /^([A-Za-z0-9][A-Za-z0-9._-]*)\s*=/.exec(line);
        if (entry && entry[1].toLowerCase() !== 'python') add('python', entry[1].toLowerCase().replace(/[-_.]+/g, '-'));
      }
    } else if (base === 'composer.json') {
      try {
        const data = JSON.parse(file.content);
        for (const section of ['require', 'require-dev']) {
          const values = data?.[section];
          if (values && typeof values === 'object' && !Array.isArray(values)) {
            for (const name of Object.keys(values)) add('composer', name);
          }
        }
      } catch { /* Invalid manifests supply no dependency evidence. */ }
    } else if (base === 'go.mod') {
      let inRequire = false;
      for (const raw of file.content.split(/\r?\n/)) {
        const line = raw.replace(/\/\/.*$/, '').trim();
        if (/^require\s*\($/.test(line)) { inRequire = true; continue; }
        if (line === ')') { inRequire = false; continue; }
        const match = (inRequire ? /^(\S+)\s+(v\S+)$/ : /^require\s+(\S+)\s+(v\S+)$/).exec(line);
        if (match) add('go', match[1], match[2], 'runtime');
      }
    } else if (base === 'Cargo.toml') {
      let section = '';
      let tableName: string | undefined;
      let tableVersion = 'unspecified';
      let tableOptional = false;
      const dependencyType = (): EcosystemDependency['type'] => /(?:dev|build)-dependencies/.test(section) ? 'development' : 'runtime';
      const flushTable = () => { if (tableName) add('cargo', tableName, tableVersion, tableOptional ? 'optional' : dependencyType()); tableName = undefined; tableVersion = 'unspecified'; tableOptional = false; };
      for (const raw of file.content.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const header = /^\[([^\]]+)\]\s*(?:#.*)?$/.exec(line);
        if (header) {
          flushTable();
          section = header[1];
          const table = /^(?:(?:target\..+|workspace)\.)?(?:dependencies|dev-dependencies|build-dependencies)\.([A-Za-z0-9_-]+)$/.exec(section);
          if (table) tableName = table[1];
          continue;
        }
        if (tableName) {
          const alias = /^package\s*=\s*["']([^"']+)["']/.exec(line);
          if (alias) tableName = alias[1];
          const version = /^version\s*=\s*["']([^"']+)["']/.exec(line);
          if (version) tableVersion = version[1];
          if (/^optional\s*=\s*true\s*(?:#.*)?$/.test(line)) tableOptional = true;
          if (/^workspace\s*=\s*true/.test(line)) tableVersion = 'workspace-inherited';
          continue;
        }
        if (!/^(?:(?:target\..+)\.)?(?:dependencies|dev-dependencies|build-dependencies)$|^workspace\.dependencies$/.test(section)) continue;
        const entry = /^([A-Za-z0-9_-]+)\s*=\s*(["'].*["']|\{.*\})\s*(?:#.*)?$/.exec(line);
        if (!entry) continue;
        const alias = /\bpackage\s*=\s*["']([^"']+)["']/.exec(entry[2]);
        const version = /^["']([^"']+)["']/.exec(entry[2])?.[1] ?? /\bversion\s*=\s*["']([^"']+)["']/.exec(entry[2])?.[1] ?? (/\bworkspace\s*=\s*true/.test(entry[2]) ? 'workspace-inherited' : 'unspecified');
        const type = /\boptional\s*=\s*true/.test(entry[2]) ? 'optional' : dependencyType();
        add('cargo', alias?.[1] ?? entry[1], version, type);
      }
      flushTable();
    }
  }
  return [...new Map(result.map(item => [item.ecosystem + '|' + item.file + '|' + item.name, item])).values()];
}
