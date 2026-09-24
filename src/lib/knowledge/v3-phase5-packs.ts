import { V3_PHASE3_RULE_PACKS } from './v3-phase3-packs';
import type { V3DependencyDetector, V3Rule, V3RulePack } from './v3-types';

/** npm dependency policies are review signals, not claims about known vulnerabilities. */
export const V3_PHASE5_VERSION = '3.4.0';
export const V3_PHASE5_RULE_TARGET = 1_000;
export const V3_PHASE5_TOTAL_TARGET = 10_000;
export const V3_PHASE5_POLICIES = [
  { id: 'unresolved-placeholder', version: '^(?:TODO|VERSION|<version>|\\$\\{[^}]+\\}|\\{\\{[^}]+\\}\\})$', example: 'TODO', title: 'Unresolved dependency version' },
  { id: 'mutable-git-branch', version: '^(?:github:|git\\+https?://)[^#\\s]+#(?:main|master|dev|HEAD)$', example: 'github:example/project#main', title: 'Dependency follows a mutable Git branch' },
  { id: 'floating-npm-alias', version: '^npm:[^@\\s]+@(?:latest|next|canary)$', example: 'npm:example@latest', title: 'npm alias follows a mutable release tag' },
  { id: 'wildcard-patch', version: '^\\d+\\.\\d+\\.(?:x|X|\\*)$', example: '2.4.x', title: 'Dependency uses a wildcard patch version' },
] as const;

function idToken(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function build(): V3RulePack[] {
  const seeds = new Map<string, { name: string; area: string; technologies: string[] }>();
  for (const pack of V3_PHASE3_RULE_PACKS) for (const rule of pack.rules) {
    const detector = rule.detectors[0] as V3DependencyDetector;
    if (detector.kind !== 'dependency' || !detector.ecosystems.includes('npm')) continue;
    const name = detector.names[0];
    if (!name || seeds.has(name.toLowerCase())) continue;
    seeds.set(name.toLowerCase(), { name, area: pack.id.split('.').at(-1) ?? 'other', technologies: rule.technologies });
  }
  if (seeds.size * V3_PHASE5_POLICIES.length < V3_PHASE5_RULE_TARGET)
    throw new Error('Phase 5 needs 250 distinct documented npm package signals.');
  const grouped = new Map<string, V3Rule[]>();
  let count = 0;
  for (const [name, seed] of seeds) {
    if (count === V3_PHASE5_RULE_TARGET) break;
    for (const policy of V3_PHASE5_POLICIES) {
      const rule: V3Rule = {
        id: 'compatibility.phase5.npm.' + idToken(name) + '.' + policy.id,
        version: V3_PHASE5_VERSION, module: 'dependency',
        title: policy.title + ': ' + seed.name,
        description: 'The declared version of ' + seed.name + ' needs a reproducibility or compatibility review. A match does not establish a broken installation.',
        technologies: [...new Set(seed.technologies)], scope: ['configuration'],
        severity: 'warning', confidence: 'review-required',
        detectors: [{ kind: 'dependency', ecosystems: ['npm'], names: [seed.name], version: policy.version }],
        evidenceRequirements: { minimum: 1, requireDetectorKinds: ['dependency'] },
        recommendation: 'Check the effective lockfile version and upstream release notes; select and test a reproducible supported version.',
        references: [], falsePositiveNotes: ['A private registry, committed lockfile, or local build policy may already make this declaration reproducible.'],
        budget: { maxFiles: 10_000, maxMatches: 10, maxContentBytes: 8 * 1024 * 1024, maxMilliseconds: 80 },
        tags: ['phase5', seed.area, policy.id],
      };
      grouped.set(seed.area, [...(grouped.get(seed.area) ?? []), rule]);
      count++;
    }
  }
  return [...grouped].map(([area, rules]): V3RulePack => ({
    schemaVersion: 3, id: 'com.ryzova.uce.v3-phase5.' + area,
    name: 'UCE V3 Phase 5 — ' + area, version: V3_PHASE5_VERSION,
    publisher: 'RyzovaTech', description: 'Version declaration review across ' + area + ' npm ecosystems.',
    uceCompatibility: '>=2.0.0 <4.0.0',
    technologies: [...new Set(rules.flatMap(rule => rule.technologies))],
    modules: ['dependency'], rules,
  }));
}
export const V3_PHASE5_RULE_PACKS = build();
export const V3_PHASE5_RULE_COUNT = V3_PHASE5_RULE_PACKS.reduce((total, pack) => total + pack.rules.length, 0);
