import type { ProjectFile } from './types';

export type BrowserName = 'Chrome' | 'Firefox' | 'Safari' | 'Edge';
export type BrowserSupportStatus = 'supported' | 'partial' | 'unsupported' | 'unknown';
export interface BrowserTarget { browser: BrowserName; version: number; }
export interface BrowserCompatibilityFinding { feature: string; kind: 'javascript' | 'css' | 'web-api'; file: string; line: number; status: BrowserSupportStatus; affectedBrowsers: BrowserName[]; recommendation: string; }
export interface BrowserCompatibilityIntelligence { targets: BrowserTarget[]; findings: BrowserCompatibilityFinding[]; score: number; filesScanned: number; featuresChecked: number; }

const DEFAULT_TARGETS: BrowserTarget[] = [
  { browser: 'Chrome', version: 109 }, { browser: 'Firefox', version: 115 },
  { browser: 'Safari', version: 16.4 }, { browser: 'Edge', version: 109 },
];

const FEATURE_MINIMUMS: Array<{ feature: string; kind: BrowserCompatibilityFinding['kind']; pattern: RegExp; minimums: Partial<Record<BrowserName, number>>; recommendation: string }> = [
  { feature: 'WebGPU', kind: 'web-api', pattern: /navigator\.gpu\b/, minimums: { Chrome: 113, Edge: 113, Firefox: 141, Safari: 26 }, recommendation: 'Feature-detect navigator.gpu and provide a fallback.' },
  { feature: 'View Transitions API', kind: 'web-api', pattern: /document\.startViewTransition\b/, minimums: { Chrome: 111, Edge: 111, Firefox: 144, Safari: 18 }, recommendation: 'Feature-detect startViewTransition and provide a normal transition fallback.' },
  { feature: 'Popover API', kind: 'web-api', pattern: /\.(?:showPopover|hidePopover|togglePopover)\s*\(|\b(?:popoverTargetElement|popoverTargetAction)\b|\bpopover\s*=\s*["'](?:auto|manual)["']/i, minimums: { Chrome: 114, Edge: 114, Firefox: 125, Safari: 17 }, recommendation: 'Feature-detect the Popover API or provide a dialog/menu fallback.' },
  { feature: 'CSS :has()', kind: 'css', pattern: /:has\s*\(/, minimums: { Chrome: 105, Edge: 105, Firefox: 121, Safari: 15.4 }, recommendation: 'Provide a fallback selector for browsers below the :has() baseline.' },
  { feature: 'CSS container queries', kind: 'css', pattern: /@container\b/, minimums: { Chrome: 105, Edge: 105, Firefox: 110, Safari: 16 }, recommendation: 'Provide a media-query or layout fallback when container queries are unavailable.' },
  { feature: 'CSS backdrop-filter', kind: 'css', pattern: /(?:^|[;{\s])(?:-webkit-)?backdrop-filter\s*:/, minimums: { Chrome: 76, Edge: 79, Firefox: 103, Safari: 9 }, recommendation: 'Provide a background fallback for browsers without backdrop-filter.' },
  { feature: 'structuredClone()', kind: 'web-api', pattern: /\bstructuredClone\s*\(/, minimums: { Chrome: 98, Edge: 98, Firefox: 94, Safari: 15.4 }, recommendation: 'Use a compatible clone fallback for older browsers.' },
  { feature: 'ResizeObserver', kind: 'web-api', pattern: /\bnew\s+ResizeObserver\s*\(|\bResizeObserver\s*\(/, minimums: { Chrome: 64, Edge: 79, Firefox: 69, Safari: 13.1 }, recommendation: 'Load a ResizeObserver polyfill when older browsers are supported.' },
  { feature: 'IntersectionObserver', kind: 'web-api', pattern: /\bnew\s+IntersectionObserver\s*\(|\bIntersectionObserver\s*\(/, minimums: { Chrome: 51, Edge: 15, Firefox: 55, Safari: 12.1 }, recommendation: 'Load a polyfill or provide an eager-loading fallback for older browsers.' },
  { feature: 'Import maps', kind: 'javascript', pattern: /<script[^>]+type=["']importmap["']/i, minimums: { Chrome: 89, Edge: 89, Firefox: 108, Safari: 16.4 }, recommendation: 'Bundle imports or provide an import-map fallback for older browsers.' },
];

function findLine(content: string, index: number): number { return content.slice(0, index).split('\n').length; }

function parseBrowserslist(files: ProjectFile[]): BrowserTarget[] {
  const pkg = files.find((file) => /(^|\/)package\.json$/i.test(file.path) && !file.isDirectory && file.content);
  if (!pkg?.content) return DEFAULT_TARGETS;
  try {
    const parsed = JSON.parse(pkg.content) as { browserslist?: unknown };
    const values = Array.isArray(parsed.browserslist) ? parsed.browserslist : typeof parsed.browserslist === 'string' ? [parsed.browserslist] : [];
    const targets: BrowserTarget[] = [];
    for (const value of values) {
      const match = /^(chrome|firefox|safari|edge)\s*(?:>=|>)\s*(\d+(?:\.\d+)?)$/i.exec(String(value).trim());
      if (!match) continue;
      const rawName = match[1].toLowerCase();
      const name: BrowserName = rawName === 'chrome' ? 'Chrome' : rawName === 'firefox' ? 'Firefox' : rawName === 'safari' ? 'Safari' : 'Edge';
      targets.push({ browser: name, version: Number(match[2]) });
    }
    return targets.length ? targets : DEFAULT_TARGETS;
  } catch { return DEFAULT_TARGETS; }
}

function isSourceFile(file: ProjectFile): boolean {
  if (file.isDirectory || typeof file.content !== 'string') return false;
  const path = file.path.replace(/\\/g, '/').toLowerCase();
  if (!/\.(?:[cm]?[jt]sx?|css|html?)$/.test(path)) return false;
  return !/(^|\/)node_modules\/|(^|\/)dist\/|(^|\/)build\/|(^|\/)coverage\/|(^|\/)[.]git\/|(^|\/)(?:vendor|generated|public)\//.test(path);
}

function isRelevantFile(file: ProjectFile, kind: BrowserCompatibilityFinding['kind']): boolean {
  const path = file.path.replace(/\\/g, '/').toLowerCase();
  if (kind === 'css') return /\.css$/i.test(path);
  if (kind === 'javascript') return /\.html?$/i.test(path);
  return /\.(?:[cm]?[jt]sx?|html?)$/i.test(path);
}

export function detectBrowserCompatibility(files: ProjectFile[]): BrowserCompatibilityIntelligence {
  const targets = parseBrowserslist(files);
  const findings: BrowserCompatibilityFinding[] = [];
  const sourceFiles = files.filter(isSourceFile);
  const seen = new Set<string>();

  for (const file of sourceFiles) {
    const content = file.content ?? '';
    for (const rule of FEATURE_MINIMUMS) {
      if (!isRelevantFile(file, rule.kind)) continue;
      const match = rule.pattern.exec(content);
      if (!match) continue;
      const affected = targets
        .filter((target) => {
          const minimum = rule.minimums[target.browser];
          return minimum !== undefined && target.version < minimum;
        })
        .map((target) => target.browser);
      if (!affected.length) continue;
      const key = `${file.path}|${rule.feature}|${affected.join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ feature: rule.feature, kind: rule.kind, file: file.path, line: findLine(content, match.index), status: 'unsupported', affectedBrowsers: affected, recommendation: rule.recommendation });
    }
  }

  const uniqueFeatureTargets = new Set(findings.map((finding) => `${finding.feature}|${finding.affectedBrowsers.join(',')}`));
  const score = uniqueFeatureTargets.size === 0 ? 100 : Math.max(0, Math.round(100 - (uniqueFeatureTargets.size / FEATURE_MINIMUMS.length) * 100));
  return { targets, findings: findings.slice(0, 200), score, filesScanned: sourceFiles.length, featuresChecked: FEATURE_MINIMUMS.length };
}
