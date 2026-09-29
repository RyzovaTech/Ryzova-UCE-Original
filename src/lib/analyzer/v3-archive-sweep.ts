import { classifyProjectFileScope } from './project-scope';
import type { AnalysisResult, ProjectFile } from './types';
import { V3_DEFAULT_RULE_PACKS } from '../knowledge/v3-default-packs';
import { dependenciesFrom, dependencyEcosystem } from '../knowledge/v3-sdk';
import type { V3ArchiveSweepCoverage, V3DependencyDetector, V3RegexDetector, V3Rule, V3RuleEvidence } from '../knowledge/v3-types';

interface RoutedRule {
  rule: V3Rule;
  packId: string;
  detector: V3RegexDetector;
  pattern: RegExp;
  include: RegExp[];
  exclude: RegExp[];
  technologies: string[];
}
interface RoutedDependency { rule: V3Rule; packId: string; detector: V3DependencyDetector; version?: RegExp }

const FINDING_LIMIT = 300;
const INFO_LIMIT = 100;
const PER_RULE_LIMIT = 5;
const FILE_TECHNOLOGY: Record<string, string> = {
  c: 'c', h: 'c', cc: 'c++', cpp: 'c++', cxx: 'c++', hpp: 'c++', js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript', py: 'python', java: 'java', kt: 'kotlin', kts: 'kotlin', go: 'go', rs: 'rust', php: 'php', rb: 'ruby',
  cs: 'csharp', swift: 'swift', html: 'html', vue: 'vue', svelte: 'svelte', dart: 'dart', yaml: 'yaml', yml: 'yaml', json: 'json', tf: 'terraform',
};

/** A standalone signature is safe to evaluate without cross-file state. */
function sweepable(rule: V3Rule): boolean {
  return rule.enabled !== false && rule.detectors.length === 1 && ['regex', 'dependency'].includes(rule.detectors[0].kind) &&
    !rule.dependsOn?.length && !rule.conflictsWith?.length && rule.evidenceRequirements.minimum <= 1 &&
    (!rule.evidenceRequirements.requireDetectorKinds?.length || rule.evidenceRequirements.requireDetectorKinds.every(kind => kind === rule.detectors[0].kind));
}

function globPattern(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '__DIRECTORY__').replace(/\*\*/g, '__GLOBSTAR__')
    .replace(/\*/g, '[^/]*').replace(/\?/g, '.').replace(/__DIRECTORY__/g, '(?:.*/)?').replace(/__GLOBSTAR__/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

function routedRules(): { byExtension: Map<string, RoutedRule[]>; fallback: RoutedRule[]; byDependency: Map<string, RoutedDependency[]>; sourceCount: number; dependencyCount: number } {
  const byExtension = new Map<string, RoutedRule[]>(); const fallback: RoutedRule[] = []; const byDependency = new Map<string, RoutedDependency[]>();
  let sourceCount = 0; let dependencyCount = 0;
  for (const pack of V3_DEFAULT_RULE_PACKS) for (const rule of pack.rules) {
    if (!sweepable(rule)) continue;
    const detector = rule.detectors[0];
    if (detector.kind === 'dependency') {
      const entry: RoutedDependency = { rule, packId: pack.id, detector, version: detector.version ? new RegExp(detector.version) : undefined };
      for (const ecosystem of detector.ecosystems) for (const name of detector.names) {
        const key = `${ecosystem}:${name.toLowerCase()}`;
        byDependency.set(key, [...(byDependency.get(key) ?? []), entry]);
      }
      dependencyCount++;
      continue;
    }
    if (detector.kind !== 'regex') continue;
    const entry: RoutedRule = {
      rule, packId: pack.id, detector, pattern: new RegExp(detector.pattern, [...new Set((detector.flags ?? '').replace(/[gy]/g, ''))].join('')),
      include: detector.include.map(globPattern), exclude: (detector.exclude ?? []).map(globPattern), technologies: rule.technologies.map(item => item.toLowerCase()),
    };
    const extensions = detector.include.map(glob => /(?:^|\/)\*\.([a-z0-9]+)$/i.exec(glob)?.[1]?.toLowerCase());
    if (extensions.every(Boolean)) for (const ext of new Set(extensions as string[])) byExtension.set(ext, [...(byExtension.get(ext) ?? []), entry]);
    else fallback.push(entry);
    sourceCount++;
  }
  return { byExtension, fallback, byDependency, sourceCount, dependencyCount };
}

export function createV3ArchiveSweep(result: AnalysisResult): { scan(files: ProjectFile[]): number; finish(): void } | null {
  const platform = result.stack.v3RulePlatform;
  if (!platform) return null;
  const routes = routedRules();
  const current: V3ArchiveSweepCoverage = platform.archiveSweep ?? {
    rulesEligible: routes.sourceCount + routes.dependencyCount, sourceRulesEligible: routes.sourceCount, dependencyRulesEligible: routes.dependencyCount,
    rulesChecked: 0, filesChecked: 0, dependencyFilesChecked: 0, ruleFileVisits: 0, findingsStored: 0, findingsOmitted: 0,
    complete: false, ruleVisits: {}, storedPerRule: {}, storedWarnings: 0, storedInfo: 0,
  };
  platform.archiveSweep = current;
  const technologies = new Set([
    result.stack.language, result.stack.framework, result.stack.runtime, result.stack.buildTool,
    ...(result.stack.languages ?? []).map(item => item.language), ...(result.stack.frameworks ?? []), ...(result.stack.runtimes ?? []),
    ...(result.stack.technologyDetections ?? []).flatMap(item => [item.id, item.name]),
  ].map(item => String(item).toLowerCase()));
  const seen = new Set(platform.findings.map(finding => `${finding.ruleId}:${finding.file}`));
  const visit = (rule: V3Rule): void => {
    if (!current.ruleVisits[rule.id]) current.rulesChecked++;
    current.ruleVisits[rule.id] = (current.ruleVisits[rule.id] ?? 0) + 1;
  };
  const store = (rule: V3Rule, packId: string, path: string, evidence: V3RuleEvidence): void => {
    const marker = `${rule.id}:${path}`;
    if (seen.has(marker)) return;
    const warning = rule.severity !== 'info';
    if (current.findingsStored >= FINDING_LIMIT || (!warning && current.storedInfo >= INFO_LIMIT) ||
        (warning && current.storedWarnings >= FINDING_LIMIT - INFO_LIMIT) || (current.storedPerRule[rule.id] ?? 0) >= PER_RULE_LIMIT) {
      current.findingsOmitted++;
      return;
    }
    current.findingsStored++;
    seen.add(marker);
    if (warning) current.storedWarnings++; else current.storedInfo++;
    current.storedPerRule[rule.id] = (current.storedPerRule[rule.id] ?? 0) + 1;
    platform.findings.push({ ruleId: rule.id, packId, title: rule.title, module: rule.module, severity: rule.severity,
      confidence: rule.confidence, file: path, line: evidence.line, evidence: [evidence], recommendation: rule.recommendation,
      falsePositiveNotes: rule.falsePositiveNotes });
  };
  return {
    scan(files) {
      let visits = 0;
      for (const file of files) {
        if (file.isDirectory || file.content === undefined) continue;
        const path = file.path.replace(/\\/g, '/'); const ext = path.split('/').pop()?.split('.').pop()?.toLowerCase() ?? '';
        const scope = classifyProjectFileScope(path);
        let checked = false;
        for (const entry of [...(routes.byExtension.get(ext) ?? []), ...routes.fallback]) {
          if (!entry.rule.scope.includes(scope) || !entry.include.some(pattern => pattern.test(path)) || entry.exclude.some(pattern => pattern.test(path))) continue;
          if (!entry.technologies.includes('*') && !entry.technologies.some(item => technologies.has(item) || item === FILE_TECHNOLOGY[ext])) continue;
          checked = true; visits++; visit(entry.rule);
          const match = entry.pattern.exec(file.content);
          if (!match) continue;
          store(entry.rule, entry.packId, path, { detector: 'regex', file: path, line: file.content.slice(0, match.index).split('\n').length, detail: match[0].replace(/\s+/g, ' ').slice(0, 160) });
        }
        const ecosystem = dependencyEcosystem(path);
        if (ecosystem && (scope === 'production' || scope === 'configuration')) {
          const visited = new Set<string>();
          checked = true; current.dependencyFilesChecked++;
          for (const [name, version] of dependenciesFrom(file)) for (const entry of routes.byDependency.get(`${ecosystem}:${name}`) ?? []) {
            if (!entry.rule.scope.includes(scope) || visited.has(entry.rule.id)) continue;
            visited.add(entry.rule.id); visits++; visit(entry.rule);
            if (entry.version && !entry.version.test(version)) continue;
            store(entry.rule, entry.packId, path, { detector: 'dependency', file: path, detail: `${name}@${version || 'declared'}` });
          }
        }
        if (checked) current.filesChecked++;
      }
      current.ruleFileVisits += visits;
      return visits;
    },
    finish() { current.complete = true; },
  };
}
