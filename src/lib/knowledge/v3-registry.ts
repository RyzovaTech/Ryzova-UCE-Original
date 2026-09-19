import { executeV3RulePacks } from './v3-sdk';
import type { V3ExecutionContext, V3ExecutionResult, V3LazyPackDescriptor, V3RulePack } from './v3-types';
import { analyzeV3RuleGraph, detectorSignature, validateV3RulePack } from './v3-validator';

export interface V3InstalledPack { pack: V3RulePack; source: 'builtin' | 'community' | 'organization'; enabled: boolean; trusted: boolean; installedAt: string; }
export interface V3RegistryConflict { type: 'duplicate-id' | 'duplicate-detector' | 'declared-conflict' | 'missing-dependency' | 'cycle'; detail: string; }

export class V3RuleRegistry {
  private readonly installed = new Map<string, V3InstalledPack>();
  private readonly lazy = new Map<string, V3LazyPackDescriptor>();

  registerPack(pack: V3RulePack, options: { source?: V3InstalledPack['source']; trusted?: boolean; allowUnsignedOrganizationPack?: boolean } = {}): void {
    const validation = validateV3RulePack(pack); if (!validation.valid) throw new Error(validation.errors.join(' '));
    const source = options.source ?? 'builtin';
    if (source !== 'builtin' && !pack.signature && !(source === 'organization' && options.allowUnsignedOrganizationPack)) throw new Error('Unsigned external packs require explicit organization approval.');
    const existing = this.installed.get(pack.id);
    if (existing && existing.pack.version === pack.version) throw new Error(`Pack ${pack.id}@${pack.version} is already installed.`);
    const candidate: V3InstalledPack = { pack, source, enabled: true, trusted: source === 'builtin' || Boolean(options.trusted), installedAt: new Date().toISOString() };
    const conflicts = this.inspectConflicts([...this.enabledPacks().filter((item) => item.id !== pack.id), pack]);
    if (conflicts.length) throw new Error(conflicts.map((item) => item.detail).join(' '));
    this.installed.set(pack.id, candidate);
  }

  registerLazyPack(descriptor: V3LazyPackDescriptor): void {
    if (this.lazy.has(descriptor.id) || this.installed.has(descriptor.id)) throw new Error(`Pack ${descriptor.id} is already registered.`);
    this.lazy.set(descriptor.id, descriptor);
  }

  async loadApplicablePacks(context: V3ExecutionContext): Promise<V3RulePack[]> {
    const technologies = new Set(context.technologies.map((item) => item.toLowerCase()));
    const descriptors = [...this.lazy.values()].filter((item) =>
      (item.technologies.includes('*') || item.technologies.some((technology) => technologies.has(technology.toLowerCase()))) &&
      (!context.modules?.length || item.modules.some((module) => context.modules?.includes(module)))
    );
    for (const descriptor of descriptors) {
      const pack = await descriptor.load();
      if (pack.id !== descriptor.id || pack.version !== descriptor.version) throw new Error(`Lazy pack descriptor mismatch for ${descriptor.id}.`);
      this.registerPack(pack, { source: 'builtin', trusted: true }); this.lazy.delete(descriptor.id);
    }
    return this.applicablePacks(context);
  }

  async execute(context: V3ExecutionContext): Promise<V3ExecutionResult> { return executeV3RulePacks(await this.loadApplicablePacks(context), context); }
  setEnabled(id: string, enabled: boolean): void { const item = this.installed.get(id); if (!item) throw new Error(`Unknown pack: ${id}.`); item.enabled = enabled; }
  list(): V3InstalledPack[] { return [...this.installed.values()].map((item) => ({ ...item })); }
  export(): string { return JSON.stringify({ schemaVersion: 3, exportedAt: new Date().toISOString(), packs: this.list() }, null, 2); }
  importOrganizationPack(raw: string, allowUnsigned = false): void { const pack = JSON.parse(raw) as V3RulePack; this.registerPack(pack, { source: 'organization', allowUnsignedOrganizationPack: allowUnsigned }); }

  inspectConflicts(packs = this.enabledPacks()): V3RegistryConflict[] {
    const output: V3RegistryConflict[] = []; const graph = analyzeV3RuleGraph(packs);
    output.push(...graph.duplicates.map((id) => ({ type: 'duplicate-id' as const, detail: `Duplicate rule id: ${id}.` })));
    output.push(...graph.conflicts.map((detail) => ({ type: 'declared-conflict' as const, detail })));
    output.push(...graph.missingDependencies.map((detail) => ({ type: 'missing-dependency' as const, detail })));
    output.push(...graph.cycles.map((cycle) => ({ type: 'cycle' as const, detail: cycle.join(' -> ') })));
    const packVersions = new Map(packs.map((pack) => [pack.id, pack.version]));
    for (const pack of packs) for (const dependency of pack.dependencies ?? []) if (!packVersions.has(dependency.id) || !versionMatches(packVersions.get(dependency.id) ?? '', dependency.version)) output.push({ type: 'missing-dependency', detail: `Pack ${pack.id} requires ${dependency.id}@${dependency.version}.` });
    const signatures = new Map<string, string>();
    for (const rule of packs.flatMap((pack) => pack.rules)) { const signature = detectorSignature(rule); const prior = signatures.get(signature); if (prior && prior !== rule.id) output.push({ type: 'duplicate-detector', detail: `Rules ${prior} and ${rule.id} have the same detector signature.` }); else signatures.set(signature, rule.id); }
    return output;
  }

  private enabledPacks(): V3RulePack[] { return [...this.installed.values()].filter((item) => item.enabled).map((item) => item.pack); }
  private applicablePacks(context: V3ExecutionContext): V3RulePack[] { const technologies = new Set(context.technologies.map((item) => item.toLowerCase())); return this.enabledPacks().filter((pack) => pack.technologies.includes('*') || pack.technologies.some((item) => technologies.has(item.toLowerCase()))); }
}

function versionMatches(version: string, range: string): boolean {
  if (range === '*' || range === version) return true;
  const [major, minor] = version.split('.').map(Number); const wanted = range.replace(/^[~^]/, '').split('.').map(Number);
  if (range.startsWith('^')) return major === wanted[0] && version.localeCompare(wanted.join('.'), undefined, { numeric: true }) >= 0;
  if (range.startsWith('~')) return major === wanted[0] && minor === wanted[1] && version.localeCompare(wanted.join('.'), undefined, { numeric: true }) >= 0;
  return false;
}
