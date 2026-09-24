import { classifyProjectFileScope, normalizeProjectPath } from '../analyzer/project-scope';
import { V3_RULE_SCHEMA_VERSION } from './v3-types';
import { analyzeV3RuleGraph, validateV3RulePack } from './v3-validator';
import type {
  V3AstDetector, V3ConfigDetector, V3DependencyDetector, V3Detector, V3ExecutionContext,
  V3ExecutionResult, V3ManifestDetector, V3ProjectFile, V3RegexDetector, V3Rule,
  V3RuleBudget, V3RuleEvidence, V3RuleFinding, V3RuleMetric, V3RulePack,
} from './v3-types';

const DEFAULT_BUDGET: V3RuleBudget = { maxFiles: 25_000, maxMatches: 100, maxContentBytes: 32 * 1024 * 1024, maxMilliseconds: 250 };

export function executeV3RulePacks(packs: V3RulePack[], context: V3ExecutionContext): V3ExecutionResult {
  const invalid = packs.map((pack) => ({ pack, validation: validateV3RulePack(pack) })).filter((item) => !item.validation.valid);
  if (invalid.length) throw new Error(invalid.map((item) => `${item.pack.id}: ${item.validation.errors.join(' ')}`).join('\n'));
  const graph = analyzeV3RuleGraph(packs);
  if (graph.duplicates.length || graph.missingDependencies.length || graph.cycles.length || graph.conflicts.length) throw new Error('V3 rule graph is not executable.');
  const rules = new Map(packs.flatMap((pack) => pack.rules.map((rule) => [rule.id, { rule, packId: pack.id }] as const)));
  const findings: V3RuleFinding[] = []; const metrics: V3RuleMetric[] = []; let skipped = 0;
  for (const id of graph.order) {
    const entry = rules.get(id); if (!entry) continue;
    const { rule, packId } = entry;
    if (!applicable(rule, context)) { skipped++; continue; }
    const output = executeRule(rule, packId, context);
    findings.push(...output.findings); metrics.push(output.metric);
  }
  return {
    schemaVersion: V3_RULE_SCHEMA_VERSION,
    packIds: packs.map((pack) => `${pack.id}@${pack.version}`),
    rulesConsidered: rules.size,
    rulesExecuted: metrics.length,
    rulesSkipped: skipped,
    findings,
    metrics,
    limitations: [
      'V3 rules perform deterministic static checks and do not prove runtime behavior.',
      'AST detectors use bounded syntax signatures until a language parser adapter is registered.',
      'Budget-truncated rules label their metrics and cannot guarantee absence outside the evaluated input.',
    ],
  };
}

function executeRule(rule: V3Rule, packId: string, context: V3ExecutionContext): { findings: V3RuleFinding[]; metric: V3RuleMetric } {
  const budget = { ...DEFAULT_BUDGET, ...rule.budget }; const started = now();
  const state = { filesVisited: 0, contentBytes: 0, matches: 0, truncated: false };
  const detectorEvidence: V3RuleEvidence[][] = [];
  for (const detector of rule.detectors) {
    if (now() - started >= budget.maxMilliseconds || state.matches >= budget.maxMatches) { state.truncated = true; break; }
    detectorEvidence.push(runDetector(detector, context, rule, budget, state, started));
  }
  const nonEmpty = detectorEvidence.filter((items) => items.length);
  const requiredKinds = rule.evidenceRequirements.requireDetectorKinds ?? [];
  const kindsSatisfied = requiredKinds.every((kind) => nonEmpty.some((items) => items[0]?.detector === kind));
  const enough = nonEmpty.length >= rule.evidenceRequirements.minimum && kindsSatisfied && (!rule.evidenceRequirements.requireAllDetectors || nonEmpty.length === rule.detectors.length);
  const evidence = enough ? nonEmpty.flat().slice(0, budget.maxMatches) : [];
  const grouped = new Map<string, V3RuleEvidence[]>();
  for (const item of evidence) grouped.set(item.file, [...(grouped.get(item.file) ?? []), item]);
  const findings: V3RuleFinding[] = [...grouped.entries()].map(([file, items]) => ({
    ruleId: rule.id, packId, title: rule.title, module: rule.module, severity: rule.severity,
    confidence: rule.confidence, file, line: items.find((item) => item.line)?.line,
    evidence: items, recommendation: rule.recommendation, falsePositiveNotes: rule.falsePositiveNotes,
  }));
  return { findings, metric: { ruleId: rule.id, ...state, durationMs: Math.max(0, now() - started) } };
}

function runDetector(detector: V3Detector, context: V3ExecutionContext, rule: V3Rule, budget: V3RuleBudget, state: MutableState, started: number): V3RuleEvidence[] {
  if (detector.kind === 'dependency') return dependencyEvidence(detector, context.files, rule, budget, state, started);
  const evidence: V3RuleEvidence[] = [];
  for (const file of context.files) {
    if (stop(state, budget, started) || state.filesVisited >= budget.maxFiles) { state.truncated = true; break; }
    if (file.isDirectory || !file.content || !rule.scope.includes(classifyProjectFileScope(file.path))) continue;
    state.filesVisited++; state.contentBytes += file.content.length;
    const found = detector.kind === 'regex' ? regexEvidence(detector, file, budget.maxMatches - state.matches)
      : detector.kind === 'ast' ? astEvidence(detector, file)
        : detector.kind === 'manifest' ? manifestEvidence(detector, file, context.manifests)
          : configEvidence(detector, file, context.manifests);
    for (const item of found) { evidence.push(item); state.matches++; if (stop(state, budget, started)) break; }
  }
  return evidence;
}

function regexEvidence(detector: V3RegexDetector, file: V3ProjectFile, limit: number): V3RuleEvidence[] {
  const path = normalizeProjectPath(file.path);
  if (!detector.include.some((glob) => globMatch(path, glob)) || detector.exclude?.some((glob) => globMatch(path, glob))) return [];
  const regex = new RegExp(detector.pattern, uniqueFlags(`${detector.flags ?? ''}g`)); const evidence: V3RuleEvidence[] = []; let match: RegExpExecArray | null;
  while ((match = regex.exec(file.content ?? ''))) {
    evidence.push({ detector: 'regex', file: path, line: lineAt(file.content ?? '', match.index), detail: safeDetail(match[0]) });
    if (evidence.length >= limit) break;
    if (!match[0].length) regex.lastIndex++;
  }
  return evidence;
}
function astEvidence(detector: V3AstDetector, file: V3ProjectFile): V3RuleEvidence[] {
  if (detector.include?.length && !detector.include.some((glob) => globMatch(file.path, glob))) return [];
  const language = languageForPath(file.path);
  if (language && !detector.languages.some((item) => item.toLowerCase() === language)) return [];
  const content = file.content ?? ''; const output: V3RuleEvidence[] = [];
  for (const name of detector.names) {
    const escaped = escapeRegExp(name); const source = detector.query === 'call' ? `\\b${escaped}\\s*\\(`
      : detector.query === 'import' ? `(?:from\\s*['"]${escaped}['"]|require\\s*\\(\\s*['"]${escaped}['"])`
        : detector.query === 'assignment' ? `\\b${escaped}\\s*=`
          : detector.query === 'jsx-attribute' ? `\\b${escaped}\\s*=` : `\\b(?:class|function|interface|type|const|let|var)\\s+${escaped}\\b`;
    const match = new RegExp(source).exec(content);
    if (match) output.push({ detector: 'ast', file: file.path, line: lineAt(content, match.index), detail: `${detector.query}:${name}` });
  }
  return output;
}
function manifestEvidence(detector: V3ManifestDetector, file: V3ProjectFile, supplied?: Record<string, unknown>): V3RuleEvidence[] {
  if (!detector.files.some((pattern) => globMatch(file.path, pattern))) return [];
  const manifest = supplied?.[file.path] ?? parseJson(file.content ?? ''); if (!manifest) return [];
  const value = atPath(manifest, detector.path); return compare(value, detector.operator, detector.value)
    ? [{ detector: 'manifest', file: file.path, detail: `${detector.path} ${detector.operator}${detector.value === undefined ? '' : ` ${detector.value}`}` }] : [];
}
function configEvidence(detector: V3ConfigDetector, file: V3ProjectFile, supplied?: Record<string, unknown>): V3RuleEvidence[] {
  if (!detector.files.some((pattern) => globMatch(file.path, pattern))) return [];
  const parsed = supplied?.[file.path] ?? parseJson(file.content ?? '');
  if (detector.path && parsed && compare(atPath(parsed, detector.path), detector.operator, detector.value)) return [{ detector: 'config', file: file.path, detail: `${detector.path} ${detector.operator}` }];
  if (detector.pattern) { const match = new RegExp(detector.pattern, 'm').exec(file.content ?? ''); if (match) return [{ detector: 'config', file: file.path, line: lineAt(file.content ?? '', match.index), detail: safeDetail(match[0]) }]; }
  if (!detector.path && compare(file.content, detector.operator, detector.value)) return [{ detector: 'config', file: file.path, detail: `content ${detector.operator}` }];
  return [];
}
function dependencyEvidence(detector: V3DependencyDetector, files: V3ProjectFile[], rule: V3Rule, budget: V3RuleBudget, state: MutableState, started: number): V3RuleEvidence[] {
  const output: V3RuleEvidence[] = [];
  for (const file of files) {
    if (stop(state, budget, started) || state.filesVisited >= budget.maxFiles) { state.truncated = true; break; }
    if (!file.content || !rule.scope.includes(classifyProjectFileScope(file.path))) continue;
    const ecosystem = dependencyEcosystem(file.path); if (!ecosystem || !detector.ecosystems.includes(ecosystem)) continue;
    const dependencies = dependenciesFrom(file);
    if (!dependencies.size) continue; state.filesVisited++; state.contentBytes += file.content.length;
    for (const name of detector.names) {
      const version = dependencies.get(name.toLowerCase());
      if (version !== undefined && (!detector.version || new RegExp(detector.version).test(version))) {
        output.push({ detector: 'dependency', file: file.path, detail: `${name}@${version || 'declared'}` }); state.matches++;
      }
    }
  }
  return output;
}

const parsedDependencies = new WeakMap<V3ProjectFile, { content: string | undefined; entries: Map<string, string> }>();
function dependenciesFrom(file: V3ProjectFile): Map<string, string> {
  const cached = parsedDependencies.get(file);
  if (cached && cached.content === file.content) return cached.entries;
  const path = file.path.toLowerCase(); const output = new Map<string, string>(); const content = file.content ?? '';
  if (path.endsWith('package.json')) {
    const value = parseJson(content) as Record<string, unknown> | undefined;
    for (const group of ['dependencies','devDependencies','peerDependencies','optionalDependencies']) {
      const entries = value?.[group]; if (entries && typeof entries === 'object') for (const [name, version] of Object.entries(entries)) output.set(name.toLowerCase(), String(version));
    }
  } else if (path.endsWith('pom.xml')) {
    for (const match of content.matchAll(/<dependency>[\s\S]*?<groupId>\s*([^<\s]+)\s*<\/groupId>[\s\S]*?<artifactId>\s*([^<\s]+)\s*<\/artifactId>[\s\S]*?(?:<version>\s*([^<\s]+)\s*<\/version>)?[\s\S]*?<\/dependency>/gi)) {
      const coordinate = `${match[1]}:${match[2]}`.toLowerCase(); output.set(coordinate, match[3] ?? 'declared'); output.set(match[2].toLowerCase(), match[3] ?? 'declared');
    }
  } else if (/build\.gradle(?:\.kts)?$/i.test(path)) {
    for (const match of content.matchAll(/(?:implementation|api|compileOnly|runtimeOnly|testImplementation|kapt)\s*\(?\s*["']([^:"']+):([^:"']+):([^"']+)["']/g)) {
      output.set(`${match[1]}:${match[2]}`.toLowerCase(), match[3]); output.set(match[2].toLowerCase(), match[3]);
    }
  } else if (path.endsWith('packages.config')) {
    for (const match of content.matchAll(/<package\s+[^>]*id=["']([^"']+)["'][^>]*version=["']([^"']+)["']/gi)) output.set(match[1].toLowerCase(), match[2]);
  } else if (/\.(?:cs|fs|vb)proj$/i.test(path)) {
    for (const match of content.matchAll(/<PackageReference\b([^>]*)>/gi)) {
      const attributes = match[1]; const name = /\bInclude=["']([^"']+)["']/i.exec(attributes)?.[1]; const version = /\bVersion=["']([^"']+)["']/i.exec(attributes)?.[1];
      if (name) output.set(name.toLowerCase(), version ?? 'declared');
    }
  } else if (/conanfile\.(?:txt|py)$/i.test(path)) {
    for (const match of content.matchAll(/^\s*([A-Za-z0-9_.+-]+)\/([^@\s#]+)/gm)) output.set(match[1].toLowerCase(), match[2]);
  } else if (path.endsWith('vcpkg.json')) {
    const value = parseJson(content) as { dependencies?: Array<string | { name?: string; version?: string; 'version>='?: string }> } | undefined;
    for (const item of value?.dependencies ?? []) {
      if (typeof item === 'string') output.set(item.toLowerCase(), 'declared');
      else if (item.name) output.set(item.name.toLowerCase(), item.version ?? item['version>='] ?? 'declared');
    }
  } else if (path.endsWith('pubspec.yaml')) {
    let inDependencies = false;
    for (const line of content.split(/\r?\n/)) {
      if (/^[^\s#][^:]*:/.test(line)) inDependencies = /^(?:dependencies|dev_dependencies):/.test(line);
      if (!inDependencies) continue;
      const match = /^ {2}([A-Za-z][\w-]*):\s*(?:['"]?([^\s#'"{}]+)['"]?)?/.exec(line);
      if (match) output.set(match[1].toLowerCase(), match[2] ?? 'declared');
    }
  } else if (path.endsWith('cargo.toml')) {
    let inDependencies = false;
    for (const line of content.split(/\r?\n/)) {
      if (/^\[/.test(line)) inDependencies = /^\[(?:dev-|build-)?dependencies(?:\.|\])/.test(line) || /^\[target\..*\.dependencies\]/.test(line);
      if (!inDependencies) continue;
      const match = /^\s*([\w-]+)\s*=\s*(?:["']([^"']+)["']|\{[^\n]*version\s*=\s*["']([^"']+)["'])/.exec(line);
      if (match) output.set(match[1].toLowerCase(), match[2] ?? match[3]);
    }
  } else if (/(requirements[^/]*\.txt|go\.mod|pyproject\.toml|composer\.json|gemfile)$/i.test(path)) {
    for (const line of content.split(/\r?\n/)) { const match = /^\s*['"]?([@\w./-]+)['"]?\s*(?:[=~^<>! ]+|\/v)([^\s,'"]+)?/.exec(line); if (match) output.set(match[1].toLowerCase(), match[2] ?? 'declared'); }
  }
  parsedDependencies.set(file, { content: file.content, entries: output });
  return output;
}
function dependencyEcosystem(path: string): V3DependencyDetector['ecosystems'][number] | undefined {
  const lower = path.toLowerCase();
  if (lower.endsWith('package.json')) return 'npm';
  if (/requirements[^/]*\.txt$|pyproject\.toml$/.test(lower)) return 'python';
  if (lower.endsWith('cargo.toml')) return 'cargo'; if (lower.endsWith('go.mod')) return 'go';
  if (lower.endsWith('pom.xml')) return 'maven'; if (/build\.gradle(?:\.kts)?$/.test(lower)) return 'gradle';
  if (lower.endsWith('composer.json')) return 'composer'; if (lower.endsWith('packages.config')) return 'nuget';
  if (/\.(?:cs|fs|vb)proj$/.test(lower)) return 'nuget'; if (/conanfile\.(?:txt|py)$/.test(lower)) return 'conan'; if (lower.endsWith('vcpkg.json')) return 'vcpkg';
  if (/gemfile$/.test(lower)) return 'ruby'; if (lower.endsWith('pubspec.yaml')) return 'dart';
  if (lower.endsWith('package.swift')) return 'swift'; if (lower.endsWith('mix.exs')) return 'mix';
  return undefined;
}
function languageForPath(path: string): string | undefined {
  const extension = path.toLowerCase().split('.').pop();
  return ({ js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin', kts: 'kotlin', cs: 'csharp', php: 'php', rb: 'ruby', swift: 'swift' } as Record<string, string>)[extension ?? ''];
}
function applicable(rule: V3Rule, context: V3ExecutionContext): boolean {
  if (rule.enabled === false || (context.modules?.length && !context.modules.includes(rule.module))) return false;
  const technologies = new Set(context.technologies.map((item) => item.toLowerCase()));
  return rule.technologies.includes('*') || rule.technologies.some((item) => technologies.has(item.toLowerCase()));
}
function stop(state: MutableState, budget: V3RuleBudget, started: number): boolean { return state.matches >= budget.maxMatches || state.contentBytes >= budget.maxContentBytes || now() - started >= budget.maxMilliseconds; }
function parseJson(value: string): unknown | undefined { try { return JSON.parse(value); } catch { return undefined; } }
function atPath(value: unknown, path: string): unknown { return path.split('.').reduce<unknown>((item, key) => item && typeof item === 'object' ? (item as Record<string, unknown>)[key] : undefined, value); }
function compare(actual: unknown, operator: string, expected?: string): boolean {
  if (operator === 'exists') return actual !== undefined && actual !== null;
  if (operator === 'equals') return String(actual) === expected;
  if (operator === 'not-equals') return String(actual) !== expected;
  if (operator === 'contains') return String(actual).includes(expected ?? '');
  if (operator === 'matches') { try { return new RegExp(expected ?? '').test(String(actual)); } catch { return false; } }
  return false;
}
function globMatch(path: string, glob: string): boolean { const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '__GLOBSTAR__').replace(/\*/g, '[^/]*').replace(/__GLOBSTAR__/g, '.*').replace(/\?/g, '.'); return new RegExp(`^${escaped}$`, 'i').test(normalizeProjectPath(path)); }
function uniqueFlags(value: string): string { return [...new Set(value)].join(''); }
function lineAt(content: string, index: number): number { return content.slice(0, index).split('\n').length; }
function safeDetail(value: string): string { return value.replace(/\s+/g, ' ').slice(0, 160); }
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function now(): number { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
interface MutableState { filesVisited: number; contentBytes: number; matches: number; truncated: boolean; }
