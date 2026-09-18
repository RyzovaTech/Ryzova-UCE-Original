import type { ProjectFile } from './types';
import { isProjectEvidenceFile, normalizeProjectPath } from './project-scope';

export type Ecosystem = 'python' | 'cargo' | 'go' | 'composer';
export interface EcosystemDependency { ecosystem: Ecosystem; name: string; file: string; }

/** Bounded, non-executing readers for common declaration forms, not full resolvers. */
export function collectEcosystemDependencies(files: ProjectFile[]): EcosystemDependency[] {
  const result: EcosystemDependency[] = [];
  for (const file of files.filter(isProjectEvidenceFile)) {
    if (!file.content) continue;
    const path = normalizeProjectPath(file.path);
    const base = path.split('/').pop() ?? path;
    const add = (ecosystem: Ecosystem, name: string) => result.push({ ecosystem, name, file: path });
    if (/^requirements(?:[-_.][\w.-]+)?\.txt$/i.test(base)) {
      for (const raw of file.content.split(/\r?\n/)) {
        const line = raw.trim();
        // Ignore includes/options/URLs; do not fetch or execute them.
        const match = /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]+\])?\s*(?:[<>=!~;@]|$)/.exec(line);
        if (match) add('python', match[1].toLowerCase().replace(/[-_.]+/g, '-'));
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
        const match = (inRequire ? /^(\S+)\s+v\S+$/ : /^require\s+(\S+)\s+v\S+$/).exec(line);
        if (match) add('go', match[1]);
      }
    } else if (base === 'Cargo.toml') {
      let section = '';
      for (const raw of file.content.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const header = /^\[([^\]]+)\]\s*(?:#.*)?$/.exec(line);
        if (header) { section = header[1]; continue; }
        if (!/^(?:dependencies|dev-dependencies|build-dependencies)$/.test(section)) continue;
        const entry = /^([A-Za-z0-9_-]+)\s*=\s*(["'].*["']|\{.*\})\s*(?:#.*)?$/.exec(line);
        if (!entry) continue;
        const alias = /\bpackage\s*=\s*["']([^"']+)["']/.exec(entry[2]);
        add('cargo', alias?.[1] ?? entry[1]);
      }
    }
  }
  return [...new Map(result.map(item => [item.ecosystem + '|' + item.file + '|' + item.name, item])).values()];
}
