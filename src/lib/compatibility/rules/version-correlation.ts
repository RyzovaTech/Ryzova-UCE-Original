import type { CompatibilityRule } from '../types';
import type { Issue } from '../../analyzer/types';
import { evidenceScope, isRecord, jsonObject, packageDirectory } from '../../analyzer/configuration-evidence';
import { normalizeProjectPath } from '../../analyzer/project-scope';
import { versionRangesDisjoint } from '../../analyzer/version-constraints';

export const versionCorrelationRules: CompatibilityRule[] = [{
  id: 'package-local-node-runtime', category: 'runtime',
  run: ctx => {
    const files = ctx.files.filter(file => !file.isDirectory && evidenceScope(file.path));
    const manifests = files.filter(file => /(^|\/)package\.json$/i.test(normalizeProjectPath(file.path)));
    const runtimeFiles = new Map<string, typeof files>();
    for (const file of files) {
      if (!/(?:^|\/)(?:\.nvmrc|\.node-version|Dockerfile)$/.test(normalizeProjectPath(file.path))) continue;
      const directory = packageDirectory(file.path), local = runtimeFiles.get(directory) ?? [];
      local.push(file); runtimeFiles.set(directory, local);
    }
    const issues: Issue[] = [];
    for (const manifest of manifests) {
      const data = jsonObject(manifest.content);
      const required = data && isRecord(data.engines) ? data.engines.node : undefined;
      if (typeof required !== 'string') continue;
      const directory = packageDirectory(manifest.path);
      for (const file of runtimeFiles.get(directory) ?? []) {
        if (!file.content) continue;
        const path = normalizeProjectPath(file.path), base = path.split('/').pop();
        const pins: Array<{ version: string; line: number }> = [];
        if ((base === '.nvmrc' || base === '.node-version') && packageDirectory(path) === directory) {
          const active = file.content.split(/\r?\n/).map((line, i) => ({ text: line.replace(/\s*#.*$/, '').trim(), line: i + 1 })).filter(row => row.text);
          if (active.length === 1 && /^v?\d+(?:\.\d+){0,2}$/.test(active[0].text)) pins.push({ version: active[0].text, line: active[0].line });
        } else if (base === 'Dockerfile' && packageDirectory(path) === directory) {
          file.content.split(/\r?\n/).forEach((line, i) => {
            const match = /^\s*FROM\s+(?:--platform=\S+\s+)?(?:docker\.io\/(?:library\/)?)?node:(\d+(?:\.\d+){0,2})(?:-[\w.-]+)?(?:@sha256:[a-f0-9]{64})?(?:\s+AS\s+[\w.-]+)?\s*(?:#.*)?$/i.exec(line);
            if (match) pins.push({ version: match[1], line: i + 1 });
          });
        }
        for (const pin of pins) {
          if (versionRangesDisjoint(required, pin.version) !== true) continue;
          issues.push({ id: `node-runtime-conflict:${path}:${pin.line}`, title: 'Node runtime selection conflicts with package engine', category: 'runtime', severity: 'warning',
            affectedFile: path, detected: pin.version, expected: required,
            description: `${path}:${pin.line} selects Node ${pin.version}, outside ${manifest.path} engines.node (${required}).`,
            reason: 'The selected runtime and declared engine have no supported numeric version in common within the same package.',
            recommendation: 'Review the runtime pin and package engine together, then test on the intended Node version.',
            impact: 'Install, build or runtime compatibility may differ across environments.' });
        }
      }
    }
    return issues;
  },
}];
