import type { BrowserCompatibilityIntelligence, BrowserName, BrowserTarget, ProjectFile } from './types';
import { BROWSER_FEATURES, BROWSER_KNOWLEDGE_VERSION } from './browser-knowledge';

const DEFAULT_TARGETS: BrowserTarget[] = [
  { browser: 'Chrome', version: 109 }, { browser: 'Firefox', version: 115 },
  { browser: 'Safari', version: 16.4 }, { browser: 'Edge', version: 109 },
];
interface TargetResolution { targets: BrowserTarget[]; source: string; usedDefaults: boolean; }

function browserName(value: string): BrowserName | undefined {
  const name = value.toLowerCase();
  if (name === 'chrome' || name === 'and_chr') return 'Chrome';
  if (name === 'firefox' || name === 'firefox_android') return 'Firefox';
  if (name === 'safari' || name === 'ios_saf') return 'Safari';
  if (name === 'edge' || name === 'and_edge') return 'Edge';
  return undefined;
}
function exactTargets(values: string[]): BrowserTarget[] {
  const targets = new Map<BrowserName, number>();
  for (const raw of values.flatMap((value) => value.split(','))) {
    const value = raw.trim();
    if (!value || value.startsWith('#') || /^\[.+\]$/.test(value)) continue;
    const match = /^(chrome|and_chr|firefox|firefox_android|safari|ios_saf|edge|and_edge)\s*(?:>=|>|=)?\s*(\d+(?:\.\d+)?)$/i.exec(value);
    if (!match) continue;
    const name = browserName(match[1]); if (!name) continue;
    const version = Number(match[2]); targets.set(name, Math.min(targets.get(name) ?? version, version));
  }
  return [...targets].map(([browser, version]) => ({ browser, version }));
}
function packageQueries(content: string): string[] {
  try {
    const value = (JSON.parse(content) as { browserslist?: unknown }).browserslist;
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
    if (value && typeof value === 'object') {
      const environments = value as Record<string, unknown>;
      const selected = environments.production ?? environments.defaults ?? Object.values(environments)[0];
      return Array.isArray(selected) ? selected.filter((item): item is string => typeof item === 'string') : typeof selected === 'string' ? [selected] : [];
    }
  } catch { /* Invalid manifests provide no target evidence. */ }
  return [];
}
export function resolveBrowserTargets(files: ProjectFile[]): TargetResolution {
  const config = files.find((file) => !file.isDirectory && /(^|\/)\.browserslistrc$/i.test(file.path) && file.content);
  if (config?.content) { const targets = exactTargets(config.content.split(/\r?\n/)); if (targets.length) return { targets, source: config.path, usedDefaults: false }; }
  const packageFile = files.find((file) => !file.isDirectory && /(^|\/)package\.json$/i.test(file.path) && file.content);
  if (packageFile?.content) { const targets = exactTargets(packageQueries(packageFile.content)); if (targets.length) return { targets, source: `${packageFile.path}#browserslist`, usedDefaults: false }; }
  return { targets: DEFAULT_TARGETS.map((target) => ({ ...target })), source: 'UCE default browser baseline', usedDefaults: true };
}

function findLine(content: string, index: number): number { return content.slice(0, index).split('\n').length; }
function isSourceFile(file: ProjectFile): boolean {
  if (file.isDirectory || typeof file.content !== 'string') return false;
  const path = file.path.replace(/\\/g, '/').toLowerCase();
  if (!/\.(?:[cm]?[jt]sx?|css|s[ac]ss|less|html?)$/.test(path)) return false;
  return !/(^|\/)(?:node_modules|dist|build|coverage|vendor|generated|public|tests?|fixtures?|examples?)(?:\/|$)|(^|\/)\.git\//.test(path);
}
function isRelevantFile(file: ProjectFile, kind: 'javascript' | 'css' | 'web-api'): boolean {
  const path = file.path.replace(/\\/g, '/').toLowerCase();
  if (kind === 'css') return /\.(?:css|s[ac]ss|less)$/.test(path);
  return /\.(?:[cm]?[jt]sx?|html?)$/.test(path);
}

export function detectBrowserCompatibility(files: ProjectFile[]): BrowserCompatibilityIntelligence {
  const resolution = resolveBrowserTargets(files); const findings: BrowserCompatibilityIntelligence['findings'] = [];
  const sourceFiles = files.filter(isSourceFile); const seen = new Set<string>();
  for (const file of sourceFiles) {
    const content = file.content ?? '';
    for (const rule of BROWSER_FEATURES) {
      if (!isRelevantFile(file, rule.kind)) continue;
      const pattern = new RegExp(rule.pattern.source, rule.pattern.flags.replace('g', '')); const match = pattern.exec(content);
      if (!match) continue;
      const affectedTargets = resolution.targets.filter((target) => rule.unsupported?.includes(target.browser) || (rule.minimums[target.browser] !== undefined && target.version < rule.minimums[target.browser]!));
      const affected = affectedTargets.map((target) => target.browser);
      if (!affected.length) continue;
      const key = `${file.path}|${rule.id}|${affected.join(',')}`; if (seen.has(key)) continue; seen.add(key);
      const status = affectedTargets.every((target) => !rule.unsupported?.includes(target.browser) && rule.partialMinimums?.[target.browser] !== undefined && target.version >= rule.partialMinimums[target.browser]!) ? 'partial' : 'unsupported';
      findings.push({ id: rule.id, feature: rule.feature, kind: rule.kind, file: file.path, line: findLine(content, match.index), status, affectedBrowsers: affected, recommendation: rule.recommendation });
    }
  }
  const uniqueFeatureTargets = new Set(findings.map((finding) => `${finding.id}|${finding.affectedBrowsers.join(',')}`));
  const score = uniqueFeatureTargets.size === 0 ? 100 : Math.max(0, Math.round(100 - (uniqueFeatureTargets.size / BROWSER_FEATURES.length) * 100));
  return { targets: resolution.targets, targetSource: resolution.source, defaultTargetsUsed: resolution.usedDefaults, knowledgeVersion: BROWSER_KNOWLEDGE_VERSION, findings: findings.slice(0, 200), score, filesScanned: sourceFiles.length, featuresChecked: BROWSER_FEATURES.length };
}
