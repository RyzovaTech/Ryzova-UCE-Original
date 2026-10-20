import type { ProjectFile } from '../analyzer/types';
import { evidenceScope, isRecord, jsonObject, packageDirectory, typescriptConfig } from '../analyzer/configuration-evidence';
import { normalizeProjectPath } from '../analyzer/project-scope';
import { versionRangesDisjoint } from '../analyzer/version-constraints';

/**
 * Phase 2: bounded, evidence-only constraint reasoning for explicitly declared
 * Node runtime pins, npm lock entries and TS module configuration.
 *
 * "satisfiable" says only that the modeled constraints overlap; it never
 * certifies application behavior. No scanned code or configuration is run.
 */
export type SymbolicStatus = 'conflict' | 'satisfiable' | 'unknown';
export type SymbolicDomain = 'runtime' | 'dependency' | 'configuration';
export interface SymbolicFact {
  kind: 'node-engine' | 'node-pin' | 'dependency-range' | 'locked-version' | 'package-type' | 'ts-module';
  file: string;
  key: string;
  value: string;
  line?: number;
}
export interface SymbolicDecision {
  id: string;
  domain: SymbolicDomain;
  workspace: string;
  subject: string;
  status: SymbolicStatus;
  facts: SymbolicFact[];
  explanation: string;
  recommendation: string;
}
export interface SymbolicReasoningResult {
  version: 1;
  decisions: SymbolicDecision[];
  counts: { conflict: number; satisfiable: number; unknown: number };
  limited: boolean;
  limitations: string[];
}

const MAX_FILES = 20_000;
const MAX_WORKSPACES = 64;
const MAX_DECISIONS = 256;
const MAX_DEPENDENCIES_PER_WORKSPACE = 24;
const MAX_FILE_CHARS = 256 * 1024;

const fact = (kind: SymbolicFact['kind'], file: string, key: string, value: string, line?: number): SymbolicFact =>
  { const entry: SymbolicFact = { kind, file, key, value }; if (line !== undefined) entry.line = line; return entry; };

function nodePin(source: string): { value: string; line: number } | undefined {
  const active = source.split(/\r?\n/).map((line, i) =>
    ({ value: line.replace(/\s*#.*$/, '').trim(), line: i + 1 })).filter(row => row.value);
  return active.length === 1 && /^v?\d+(?:\.\d+){0,2}$/.test(active[0].value) ? active[0] : undefined;
}

function decision(
  domain: SymbolicDomain, workspace: string, subject: string,
  facts: SymbolicFact[], status: SymbolicStatus, explanation: string, recommendation: string,
): SymbolicDecision {
  return { id: domain + ':' + (workspace || '.') + ':' + subject, domain, workspace, subject, status, facts, explanation, recommendation };
}

function moduleStatus(value: unknown, data: Record<string, unknown>, config: Record<string, unknown>): SymbolicStatus {
  if (typeof value !== 'string' || !['module', 'commonjs'].includes(value)) return 'unknown';
  // Inheritance, noEmit and declaration-only output do not establish emitted JS.
  if (typeof config.extends === 'string' || data.noEmit !== undefined && data.noEmit !== false ||
      data.emitDeclarationOnly !== undefined && data.emitDeclarationOnly !== false) return 'unknown';
  if (typeof data.module !== 'string') return 'unknown';
  if (value === 'module' && /^commonjs$/i.test(data.module)) return 'conflict';
  if (value === 'module' && /^(es20\d\d|esnext|nodenext|node16|node18|node20)$/i.test(data.module)) return 'satisfiable';
  return 'unknown';
}

export function evaluateSymbolicReasoning(files: ProjectFile[]): SymbolicReasoningResult {
  const decisions: SymbolicDecision[] = [];
  const map = new Map<string, ProjectFile>();
  let limited = files.length > MAX_FILES;
  // A truncated input set is not grounds for negative/absence assertions.
  for (const file of files.slice(0, MAX_FILES)) {
    if (file.isDirectory || !evidenceScope(file.path)) continue;
    const path = normalizeProjectPath(file.path);
    if (!map.has(path)) map.set(path, file);
  }

  const manifests = [...map.entries()].filter(([path]) => /(^|\/)package\.json$/i.test(path));
  if (manifests.length > MAX_WORKSPACES) limited = true;
  for (const [path, file] of manifests.slice(0, MAX_WORKSPACES)) {
    if (decisions.length >= MAX_DECISIONS) { limited = true; break; }
    const workspace = packageDirectory(path);
    const sibling = (name: string) => map.get((workspace ? workspace + '/' : '') + name);
    const read = (candidate?: ProjectFile): string | undefined =>
      candidate?.content !== undefined && candidate.content.length <= MAX_FILE_CHARS ? candidate.content : undefined;
    const raw = read(file);
    if (!raw) { limited = true; continue; }
    const pkg = jsonObject(raw);
    if (!pkg) continue;

    // Pair runtime evidence only from the same package root. A parent package's
    // engine is not inferred to constrain sibling workspaces.
    for (const name of ['.nvmrc', '.node-version']) {
      const selected = sibling(name);
      if (!selected) continue;
      const required = isRecord(pkg.engines) ? pkg.engines.node : undefined;
      const pinSource = read(selected), pin = pinSource === undefined ? undefined : nodePin(pinSource);
      const facts: SymbolicFact[] = [];
      if (typeof required === 'string') facts.push(fact('node-engine', path, 'engines.node', required));
      if (pin) facts.push(fact('node-pin', normalizeProjectPath(selected.path), name, pin.value, pin.line));
      const overlap = typeof required === 'string' && pin ? versionRangesDisjoint(required, pin.value) : undefined;
      const status: SymbolicStatus = overlap === true ? 'conflict' : overlap === false ? 'satisfiable' : 'unknown';
      decisions.push(decision('runtime', workspace, 'node:' + name, facts, status,
        status === 'conflict' ? 'Explicit Node pin and engines.node have no overlapping stable numeric versions.'
          : status === 'satisfiable' ? 'The declared Node ranges overlap; runtime behavior is not verified.'
            : 'A supported Node engine requirement or single numeric runtime pin is missing or ambiguous.',
        'Review engines.node and the same-workspace runtime pin; verify the intended Node version.'));
      if (decisions.length >= MAX_DECISIONS) { limited = true; break; }
    }

    const lock = sibling('package-lock.json');
    if (lock && decisions.length < MAX_DECISIONS) {
      const lockText = read(lock);
      const lockData = lockText === undefined ? undefined : jsonObject(lockText);
      const packages = lockData && isRecord(lockData.packages) ? lockData.packages : undefined;
      const selected = new Map<string, string>();
      for (const group of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
        const entries = pkg[group];
        if (!isRecord(entries)) continue;
        for (const [name, range] of Object.entries(entries)) {
          if (typeof range === 'string' && !selected.has(name)) selected.set(name, range);
        }
      }
      if (selected.size > MAX_DEPENDENCIES_PER_WORKSPACE) limited = true;
      for (const [name, range] of [...selected].slice(0, MAX_DEPENDENCIES_PER_WORKSPACE)) {
        if (decisions.length >= MAX_DECISIONS) { limited = true; break; }
        const pathKey = 'node_modules/' + name;
        const locked = packages && isRecord(packages[pathKey]) ? packages[pathKey].version : undefined;
        const facts = [fact('dependency-range', path, name, range)];
        if (typeof locked === 'string') facts.push(fact('locked-version', normalizeProjectPath(lock.path), pathKey, locked));
        const disjoint = typeof locked === 'string' ? versionRangesDisjoint(range, locked) : undefined;
        const status: SymbolicStatus = disjoint === true ? 'conflict' : disjoint === false ? 'satisfiable' : 'unknown';
        decisions.push(decision('dependency', workspace, name, facts, status,
          status === 'conflict' ? 'The lockfile resolution is outside the declared dependency range.'
            : status === 'satisfiable' ? 'The installed version falls within the modeled declaration range; package behavior is unverified.'
              : 'No supported, exact resolved version and numeric declaration pair is available.',
          'Review the dependency declaration and corresponding package-lock.json entry in the same workspace.'));
      }
    }

    const tsconfigFile = sibling('tsconfig.json');
    if (tsconfigFile && decisions.length < MAX_DECISIONS) {
      const configRaw = read(tsconfigFile);
      const config = typescriptConfig(configRaw);
      const compilerOptions = config && isRecord(config.compilerOptions) ? config.compilerOptions : undefined;
      const type = pkg.type;
      const module = compilerOptions?.module;
      const facts: SymbolicFact[] = [];
      if (typeof type === 'string') facts.push(fact('package-type', path, 'type', type));
      if (typeof module === 'string') facts.push(fact('ts-module', normalizeProjectPath(tsconfigFile.path), 'compilerOptions.module', module));
      const status: SymbolicStatus = config && compilerOptions ? moduleStatus(type, compilerOptions, config) : 'unknown';
      decisions.push(decision('configuration', workspace, 'module-format', facts, status,
        status === 'conflict' ? 'An ESM package declares TypeScript CommonJS output without an explicit no-emit boundary.'
          : status === 'satisfiable' ? 'The declared ESM package type and TypeScript module mode align syntactically; runtime behavior is unverified.'
            : 'Effective emitted JavaScript module format cannot be established from these direct declarations.',
        'Review package.json type, tsconfig compilerOptions and any inherited/bundler configuration.'));
    }
  }

  const counts = { conflict: 0, satisfiable: 0, unknown: 0 };
  for (const item of decisions) counts[item.status]++;
  return {
    version: 1, decisions, counts, limited,
    limitations: [
      'Constraint satisfiability does not establish runtime or application compatibility.',
      'Only same-directory Node pins, package-lock.json entries and directly emitted TS module settings are modeled; unsupported ranges and missing evidence stay unknown.',
      ...(limited ? ['Input, workspace, dependency or decision budgets limit coverage; absence of conflicts is not guaranteed.'] : []),
    ],
  };
}
