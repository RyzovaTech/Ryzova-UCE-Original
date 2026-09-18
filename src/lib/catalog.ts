import { TECHNOLOGY_REGISTRY, TECHNOLOGY_REGISTRY_VERSION, type TechnologyDefinition } from './analyzer/technology-registry';
import { ADDITIONAL_LANGUAGE_EXTENSIONS } from './analyzer/language-knowledge';
import { BROWSER_FEATURES, BROWSER_KNOWLEDGE_VERSION } from './analyzer/browser-knowledge';
import { SECURITY_RULES, SECURITY_KNOWLEDGE_VERSION } from './analyzer/security-knowledge';

export type CatalogSection = 'languages' | 'technologies' | 'architecture' | 'browser' | 'security' | 'intelligence';
export interface CatalogItem {
  id: string; name: string; section: CatalogSection; category: string; description: string;
  evidence: string[]; status: 'Confirmed support' | 'Strong support' | 'Static analysis only'; version: string;
  recommendation?: string;
}

const CORE_LANGUAGES = ['TypeScript','JavaScript','Python','Java','Kotlin','Go','Rust','PHP','Ruby','Elixir','Dart','C','C++','Swift','Scala','C#','Zig','OCaml','Haskell','Lua','Julia','R','Crystal','Nim','Solidity','V','Perl','Erlang'];
const ARCHITECTURES = ['SPA','SSR','SSG','API Server','Frontend + Backend','Library','Monorepo','CLI','Mobile App','Desktop App','Microservices','Modular Monolith','Serverless','Event-driven','Clean/Hexagonal','MVC','MVVM','Microfrontend','Plugin Architecture','Offline-first','Background Workers','Containerized Application'];
const INTELLIGENCE = [
  ['Project Intelligence','Project identity, purpose, repository roots, workspaces, and structure.'],['Language Intelligence','Primary, secondary, and mixed-language composition.'],['Technology Intelligence','Frameworks, libraries, runtimes, tools, and services.'],['Code Intelligence','Symbols, imports, calls, APIs, complexity, duplication, and dependency cycles.'],['Dependency Intelligence','Packages, versions, conflicts, lockfiles, and dependency health.'],['Architecture Intelligence','Application and system architecture patterns with evidence.'],['Runtime Intelligence','Runtime requirements and compatibility indicators.'],['Platform Intelligence','Windows, Linux, macOS, mobile, and platform-specific evidence.'],['Build Intelligence','Build tools, commands, and configuration conflicts.'],['Testing Intelligence','Test frameworks, structure, and coverage readiness.'],['Performance Intelligence','Large assets, blocking patterns, and bundle risks.'],['Accessibility Intelligence','Deterministic HTML and JSX accessibility checks.'],['API Intelligence','REST and file-based endpoint discovery.'],['Database Intelligence','Database engines, ORMs, schemas, and migrations.'],['Environment Intelligence','Required variables, examples, and configuration gaps.'],['Deployment Intelligence','Cloud, containers, CI/CD, and deployment readiness.'],['License Intelligence','Project and dependency licensing review signals.'],['Documentation Intelligence','README, setup, contribution, and API documentation.'],['Maintainability Intelligence','Complexity, large modules, duplication, and technical debt.'],['Repository Intelligence','Ignore rules, workflows, and repository health.'],['Compatibility Intelligence','Combined readiness and compatibility scoring.'],
] as const;

function technologyEvidence(item: TechnologyDefinition): string[] {
  const evidence: string[] = [];
  if (item.dependencies?.length) evidence.push(`Dependencies: ${item.dependencies.slice(0, 5).join(', ')}`);
  if (item.ecosystemDependencies?.length) evidence.push(`Ecosystem manifests: ${item.ecosystemDependencies.slice(0, 4).map(value => `${value.ecosystem}:${value.name}`).join(', ')}`);
  if (item.files?.length) evidence.push(`Files: ${item.files.slice(0, 5).join(', ')}`);
  if (item.filePrefixes?.length) evidence.push(`File prefixes: ${item.filePrefixes.slice(0, 4).join(', ')}`);
  if (item.pathPatterns?.length) evidence.push(`${item.pathPatterns.length} path pattern${item.pathPatterns.length === 1 ? '' : 's'}`);
  if (item.manifestPatterns?.length) evidence.push(`Manifest signatures: ${item.manifestPatterns.flatMap(value => value.files).slice(0, 5).join(', ')}`);
  return evidence;
}

const languageExtensions = new Map<string, string[]>();
for (const [extension, language] of Object.entries(ADDITIONAL_LANGUAGE_EXTENSIONS)) languageExtensions.set(language, [...(languageExtensions.get(language) ?? []), extension]);
const languages = [...new Set([...CORE_LANGUAGES, ...languageExtensions.keys()])].sort().map<CatalogItem>((name) => ({
  id: `language-${name.toLowerCase().replace(/\+/g, 'plus').replace(/#/g, 'sharp').replace(/[^a-z0-9]+/g, '-')}`, name, section: 'languages', category: 'Language',
  description: `UCE can include ${name} in primary, secondary, and mixed-language project profiles.`,
  evidence: languageExtensions.has(name) ? [`Extensions: ${languageExtensions.get(name)!.join(', ')}`] : ['Core source extension and project manifest evidence'],
  status: 'Strong support', version: TECHNOLOGY_REGISTRY_VERSION,
}));

// Several registry packs can contribute evidence for the same named technology.
// The catalog presents one discoverable entry and merges those definitions rather
// than making users interpret visually identical cards.
const technologyGroups = new Map<string, TechnologyDefinition[]>();
for (const definition of TECHNOLOGY_REGISTRY) {
  const key = definition.name.trim().toLocaleLowerCase();
  technologyGroups.set(key, [...(technologyGroups.get(key) ?? []), definition]);
}
const technologyCatalogItems = [...technologyGroups.values()].map<CatalogItem>((definitions) => {
  const primary = definitions[0];
  const categories = [...new Set(definitions.map((item) => item.kind))];
  const evidence = [...new Set(definitions.flatMap(technologyEvidence))];
  return {
    id: `technology-${primary.id}`,
    name: primary.name,
    section: 'technologies',
    category: categories.join(' · '),
    description: definitions.length === 1
      ? `${primary.name} detection definition in the UCE technology registry.`
      : `${primary.name} combines ${definitions.length} registry definitions into one detection profile.`,
    evidence,
    status: 'Strong support',
    version: TECHNOLOGY_REGISTRY_VERSION,
  };
});

export const UCE_CATALOG_ITEMS: readonly CatalogItem[] = [
  ...languages,
  ...technologyCatalogItems,
  ...ARCHITECTURES.map<CatalogItem>((name) => ({ id: `architecture-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, name, section: 'architecture', category: 'Architecture pattern', description: `Evidence-based ${name} architecture classification.`, evidence: ['Project structure', 'Technology relationships', 'Configuration and manifest markers'], status: 'Static analysis only', version: '2.0' })),
  ...BROWSER_FEATURES.map<CatalogItem>((item) => ({ id: `browser-${item.id}`, name: item.feature, section: 'browser', category: item.kind, description: `Checks this feature against configured desktop and mobile browser targets.`, evidence: [`Rule ID: ${item.id}`, `Minimum-version data for ${Object.keys(item.minimums).join(', ')}`], status: 'Static analysis only', version: BROWSER_KNOWLEDGE_VERSION, recommendation: item.recommendation })),
  ...SECURITY_RULES.map<CatalogItem>((item) => ({ id: `security-${item.id}`, name: item.title, section: 'security', category: item.category, description: item.evidence, evidence: [`Rule ID: ${item.id}`, `Severity: ${item.severity}`, `Confidence: ${item.confidence}`], status: 'Static analysis only', version: SECURITY_KNOWLEDGE_VERSION, recommendation: item.recommendation })),
  ...INTELLIGENCE.map<CatalogItem>(([name, description], index) => ({ id: `intelligence-${index + 1}`, name, section: 'intelligence', category: 'Intelligence module', description, evidence: ['Normalized evidence', 'Confidence and limitations', 'Actionable recommendations'], status: 'Confirmed support', version: '3.5' })),
];

export const UCE_CATALOG_COUNTS = {
  languages: languages.length, technologies: TECHNOLOGY_REGISTRY.length, architecture: ARCHITECTURES.length,
  browser: BROWSER_FEATURES.length, security: SECURITY_RULES.length, intelligence: INTELLIGENCE.length,
};
