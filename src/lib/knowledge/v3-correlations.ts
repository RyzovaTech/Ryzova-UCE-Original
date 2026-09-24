import { BROWSER_FEATURES } from '../analyzer/browser-knowledge';
import { resolveBrowserTargets } from '../analyzer/browser-compatibility';
import { classifyProjectFileScope, normalizeProjectPath } from '../analyzer/project-scope';
import type { V3CorrelationDetector, V3ExecutionContext, V3ProjectFile, V3Rule, V3RuleBudget, V3RuleEvidence } from './v3-types';

interface State { filesVisited: number; contentBytes: number; matches: number; truncated: boolean }
interface Hit { file: V3ProjectFile; line: number }
const features = new Map(BROWSER_FEATURES.map(feature => [feature.id, feature]));

export function correlationEvidence(detector: V3CorrelationDetector, context: V3ExecutionContext, rule: V3Rule, budget: V3RuleBudget, state: State, started: number): V3RuleEvidence[] {
  const files = context.files.filter(file => !file.isDirectory && typeof file.content === 'string' && rule.scope.includes(classifyProjectFileScope(file.path)));
  const evidence: V3RuleEvidence[] = [];
  const elapsed = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
  const visit = (file: V3ProjectFile) => {
    if (state.filesVisited >= budget.maxFiles || state.contentBytes >= budget.maxContentBytes || state.matches >= budget.maxMatches || elapsed() >= budget.maxMilliseconds) { state.truncated = true; return false; }
    state.filesVisited++; state.contentBytes += file.content?.length ?? 0; return true;
  };
  const add = (hit: Hit, related: Hit | undefined, detail: string) => {
    if (state.matches >= budget.maxMatches || elapsed() >= budget.maxMilliseconds) { state.truncated = true; return; }
    evidence.push({ detector: 'correlation', file: normalizeProjectPath(hit.file.path), line: hit.line, detail: detail.slice(0, 180),
      ...(related ? { relatedFile: normalizeProjectPath(related.file.path), relatedLine: related.line } : {}) });
    state.matches++;
  };
  if (detector.mode === 'browser-target') {
    const feature = features.get(detector.featureId);
    const resolution = resolveBrowserTargets(context.files.map(file => ({ ...file, isDirectory: Boolean(file.isDirectory) })));
    const target = resolution.targets.find(item => item.browser === detector.browser);
    if (!feature || !target || resolution.usedDefaults) return [];
    const minimum = feature.minimums[target.browser] ?? (target.browser === 'Chrome Android' ? feature.minimums.Chrome : target.browser === 'Safari iOS' ? feature.minimums.Safari : undefined);
    if (minimum !== undefined && target.version >= minimum && !feature.unsupported?.includes(target.browser)) return [];
    const config = context.files.find(file => normalizeProjectPath(file.path) === resolution.source.replace(/#browserslist$/, ''));
    for (const file of files) {
      if (!browserFile(file, feature.kind)) continue;
      if (!visit(file)) break;
      const match = new RegExp(feature.pattern.source, feature.pattern.flags.replace(/g/g, '')).exec(file.content ?? '');
      if (match) add({ file, line: lineAt(file.content ?? '', match.index) }, config ? { file: config, line: 1 } : undefined,
        feature.feature + ': ' + target.browser + ' ' + target.version + ' below support ' + (minimum ?? 'unavailable') + '; ' + resolution.source);
    }
  } else if (detector.mode === 'lockfile-version') {
    for (const manifest of files.filter(file => /(^|\/)package\.json$/i.test(normalizeProjectPath(file.path)))) {
      if (!visit(manifest)) break;
      const value = parseJson(manifest.content) as Record<string, unknown> | undefined;
      const groups = ['dependencies', 'devDependencies', 'optionalDependencies'];
      const declared = groups.map(group => (value?.[group] as Record<string, unknown> | undefined)?.[detector.packageName]).find(item => typeof item === 'string');
      if (typeof declared !== 'string' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(declared)) continue;
      const path = normalizeProjectPath(manifest.path);
      const lock = context.files.find(file => normalizeProjectPath(file.path) === path.slice(0, -'package.json'.length) + 'package-lock.json');
      if (!lock?.content || !visit(lock)) continue;
      const locked = parseJson(lock.content) as { packages?: Record<string, { version?: string }>; dependencies?: Record<string, { version?: string }> } | undefined;
      const installed = locked?.packages?.['node_modules/' + detector.packageName]?.version ?? locked?.dependencies?.[detector.packageName]?.version;
      if (installed && installed !== declared) add({ file: manifest, line: lineOf(manifest.content ?? '', '"' + detector.packageName + '"') },
        { file: lock, line: lineOf(lock.content, '"' + detector.packageName + '"') }, detector.packageName + ': declared ' + declared + ', locked ' + installed);
    }
  } else if (detector.mode === 'flow') {
    const source = new RegExp(detector.sourcePattern, 'g');
    for (const file of files) {
      if (!matchesAny(file.path, detector.include)) continue;
      if (!visit(file)) break;
      const content = file.content ?? ''; source.lastIndex = 0;
      for (const match of content.matchAll(source)) {
        const variable = match[1]; if (!variable || !/^[A-Za-z_$][\w$]*$/.test(variable)) continue;
        const after = content.slice(match.index + match[0].length, match.index + match[0].length + 4_000);
        const sink = new RegExp(detector.sinkPattern.replace(/\{\{variable\}\}/g, () => escape(variable))).exec(after);
        if (!sink || lineAt(after, sink.index) > (detector.maxLineDistance ?? 35)) continue;
        if (new RegExp('\\b' + escape(variable) + '\\s*=(?!=)').test(after.slice(0, sink.index))) continue;
        add({ file, line: lineAt(content, match.index) }, { file, line: lineAt(content, match.index + match[0].length + sink.index) },
          'Possible direct value path for ' + variable + '; manually review control flow');
      }
    }
  } else if (detector.mode === 'import-boundary') {
    const targets = files.filter(file => matchesAny(file.path, detector.target));
    if (!targets.length) return [];
    for (const file of files) {
      if (!matchesAny(file.path, detector.include)) continue;
      if (!visit(file)) break;
      const content = file.content ?? '';
      for (const match of content.matchAll(/(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*|\bimport\s*)["'](\.{1,2}\/[^"']+)["']/g)) {
        const candidate = resolveImport(file.path, match[1]);
        const destination = targets.find(item => { const path = normalizeProjectPath(item.path); return path === candidate || path.startsWith(candidate + '.') || path.startsWith(candidate + '/index.'); });
        if (destination) add({ file, line: lineAt(content, match.index) }, { file: destination, line: 1 }, 'Import crosses into ' + destination.path);
      }
    }
  } else {
    const left: Hit[] = []; const right: Hit[] = [];
    for (const file of files) {
      const a = matchesAny(file.path, detector.first.include); const b = matchesAny(file.path, detector.second.include);
      if (!a && !b) continue;
      if (!visit(file)) break;
      if (a) { const match = new RegExp(detector.first.pattern).exec(file.content ?? ''); if (match) left.push({ file, line: lineAt(file.content ?? '', match.index) }); }
      if (b) { const match = new RegExp(detector.second.pattern).exec(file.content ?? ''); if (match) right.push({ file, line: lineAt(file.content ?? '', match.index) }); }
    }
    for (const source of left) {
      const target = right.find(hit => detector.relation === 'same-file' ? hit.file.path === source.file.path : workspace(hit.file.path, context.files) === workspace(source.file.path, context.files));
      if (target) add(source, target, 'Related configuration or code evidence requires review');
    }
  }
  return evidence;
}

function browserFile(file: V3ProjectFile, kind: string): boolean {
  if (kind === 'css') return /\.(?:css|scss|sass|less)$/i.test(file.path);
  if (kind === 'html') return /\.html?$/i.test(file.path);
  return /\.(?:[cm]?[jt]sx?|html?)$/i.test(file.path);
}
function matchesAny(path: string, globs: string[]): boolean {
  const normalized = normalizeProjectPath(path);
  return globs.some(glob => new RegExp('^' + glob.replace(/[.+^$(){}|[\]\\]/g, '\\$&').replace(/\*\*\//g, '__PREFIX__').replace(/\*\*/g, '__ALL__').replace(/\*/g, '[^/]*').replace(/__PREFIX__/g, '(?:.*/)?').replace(/__ALL__/g, '.*') + '$', 'i').test(normalized));
}
function resolveImport(source: string, imported: string): string {
  const parts = normalizeProjectPath(source).split('/').slice(0, -1);
  for (const part of imported.split('/')) { if (part === '..') parts.pop(); else if (part && part !== '.') parts.push(part); }
  return parts.join('/');
}
function workspace(path: string, files: V3ProjectFile[]): string {
  const parts = normalizeProjectPath(path).split('/').slice(0, -1);
  for (let n = parts.length; n >= 0; n--) {
    const prefix = parts.slice(0, n).join('/');
    if (files.some(file => normalizeProjectPath(file.path) === (prefix ? prefix + '/' : '') + 'package.json')) return prefix;
  }
  return '';
}
function lineAt(content: string, offset: number): number { return content.slice(0, offset).split('\n').length; }
function lineOf(content: string, token: string): number { return lineAt(content, Math.max(0, content.indexOf(token))); }
function escape(value: string): string { return value.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&'); }
function parseJson(content: string | undefined): unknown { try { return JSON.parse(content ?? ''); } catch { return undefined; } }
