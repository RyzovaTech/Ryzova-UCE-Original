import type { ProjectFile, TechnologyDetection, TechnologyKind } from './types';
import { TECHNOLOGY_KNOWLEDGE } from './technology-knowledge';
import { ECOSYSTEM_KNOWLEDGE } from './ecosystem-knowledge';
import { PLATFORM_KNOWLEDGE } from './platform-knowledge';
import { collectEcosystemDependencies, type Ecosystem } from './ecosystem-dependencies';
import { isProjectEvidenceFile, normalizeProjectPath } from './project-scope';

export interface TechnologyDefinition {
  id: string;
  name: string;
  kind: TechnologyKind;
  dependencies?: string[];
  ecosystemDependencies?: Array<{ ecosystem: Ecosystem; name: string }>;
  files?: string[];
  filePrefixes?: string[];
  pathPatterns?: RegExp[];
  structuredManifest?: 'flutter-sdk' | 'dotnet-sdk';
  manifestPatterns?: Array<{ files: string[]; pattern: RegExp }>;
}

import { javascriptImportEvidence, packageOwner } from './javascript-import-evidence';
import { npmDeclarations, ecosystemIdentities, hasDotnetSdk, hasFlutterSdk, npmLockCorroborates } from './declaration-evidence';

const framework = (id: string, name: string, definition: Omit<TechnologyDefinition, 'id' | 'name' | 'kind'>): TechnologyDefinition => ({ id, name, kind: 'framework', ...definition });
const runtime = (id: string, name: string, definition: Omit<TechnologyDefinition, 'id' | 'name' | 'kind'>): TechnologyDefinition => ({ id, name, kind: 'runtime', ...definition });

/** Versioned knowledge registry. Adding a technology must not require detector changes. */
export const TECHNOLOGY_REGISTRY_VERSION = '2.3.0';
export const TECHNOLOGY_REGISTRY: readonly TechnologyDefinition[] = [
  ...TECHNOLOGY_KNOWLEDGE,
  ...ECOSYSTEM_KNOWLEDGE,
  ...PLATFORM_KNOWLEDGE,
  framework('nextjs', 'Next.js', { dependencies: ['next'], filePrefixes: ['next.config.'] }),
  framework('nuxt', 'Nuxt', { dependencies: ['nuxt'], filePrefixes: ['nuxt.config.'] }),
  framework('astro', 'Astro', { dependencies: ['astro'], filePrefixes: ['astro.config.'] }),
  framework('remix', 'Remix', { dependencies: ['@remix-run/react', '@remix-run/node'], filePrefixes: ['remix.config.'] }),
  framework('gatsby', 'Gatsby', { dependencies: ['gatsby'], filePrefixes: ['gatsby-config.'] }),
  framework('angular', 'Angular', { dependencies: ['@angular/core'], files: ['angular.json'] }),
  framework('sveltekit', 'SvelteKit', { dependencies: ['@sveltejs/kit'] }),
  framework('svelte', 'Svelte', { dependencies: ['svelte'], filePrefixes: ['svelte.config.'] }),
  framework('react', 'React', { dependencies: ['react', 'react-dom'] }),
  framework('vue', 'Vue', { dependencies: ['vue'] }),
  framework('solid', 'Solid', { dependencies: ['solid-js'] }),
  framework('qwik', 'Qwik', { dependencies: ['@builder.io/qwik'] }),
  framework('preact', 'Preact', { dependencies: ['preact'] }),
  framework('alpine', 'Alpine.js', { dependencies: ['alpinejs'] }),
  framework('lit', 'Lit', { dependencies: ['lit'] }),
  framework('stencil', 'Stencil', { dependencies: ['@stencil/core'] }),
  framework('express', 'Express', { dependencies: ['express'] }),
  framework('nestjs', 'NestJS', { dependencies: ['@nestjs/core', 'nestjs'] }),
  framework('fastify', 'Fastify', { dependencies: ['fastify'] }),
  framework('hono', 'Hono', { dependencies: ['hono'] }),
  framework('django', 'Django', { ecosystemDependencies: [{ ecosystem: 'python', name: 'django' }] }),
  framework('flask', 'Flask', { ecosystemDependencies: [{ ecosystem: 'python', name: 'flask' }] }),
  framework('fastapi', 'FastAPI', { ecosystemDependencies: [{ ecosystem: 'python', name: 'fastapi' }] }),
  framework('spring-boot', 'Spring Boot', { manifestPatterns: [{ files: ['pom.xml', 'build.gradle', 'build.gradle.kts'], pattern: /spring-boot|org\.springframework/i }] }),
  framework('quarkus', 'Quarkus', { manifestPatterns: [{ files: ['pom.xml', 'build.gradle', 'build.gradle.kts'], pattern: /quarkus|io\.quarkus/i }] }),
  framework('ktor', 'Ktor', { manifestPatterns: [{ files: ['build.gradle', 'build.gradle.kts'], pattern: /ktor|io\.ktor/i }] }),
  framework('micronaut', 'Micronaut', { manifestPatterns: [{ files: ['pom.xml', 'build.gradle', 'build.gradle.kts'], pattern: /micronaut|io\.micronaut/i }] }),
  framework('play', 'Play Framework', { manifestPatterns: [{ files: ['pom.xml', 'build.sbt'], pattern: /playframework|com\.typesafe\.play|play\.api/i }] }),
  framework('gin', 'Gin', { ecosystemDependencies: [{ ecosystem: 'go', name: 'github.com/gin-gonic/gin' }] }),
  framework('fiber', 'Fiber', { ecosystemDependencies: [{ ecosystem: 'go', name: 'github.com/gofiber/fiber/v2' }, { ecosystem: 'go', name: 'github.com/gofiber/fiber' }, { ecosystem: 'go', name: 'github.com/gofiber/fiber/v3' }] }),
  framework('echo', 'Echo', { ecosystemDependencies: [{ ecosystem: 'go', name: 'github.com/labstack/echo/v4' }, { ecosystem: 'go', name: 'github.com/labstack/echo' }] }),
  framework('chi', 'Chi', { ecosystemDependencies: [{ ecosystem: 'go', name: 'github.com/go-chi/chi/v5' }, { ecosystem: 'go', name: 'github.com/go-chi/chi' }] }),
  framework('revel', 'Revel', { ecosystemDependencies: [{ ecosystem: 'go', name: 'github.com/revel/revel' }] }),
  framework('actix', 'Actix', { ecosystemDependencies: [{ ecosystem: 'cargo', name: 'actix-web' }] }),
  framework('axum', 'Axum', { ecosystemDependencies: [{ ecosystem: 'cargo', name: 'axum' }] }),
  framework('rocket', 'Rocket', { ecosystemDependencies: [{ ecosystem: 'cargo', name: 'rocket' }] }),
  framework('rails', 'Rails', { manifestPatterns: [{ files: ['Gemfile', 'gems.rb'], pattern: /\brails\b/i }] }),
  framework('sinatra', 'Sinatra', { manifestPatterns: [{ files: ['Gemfile', 'gems.rb'], pattern: /\bsinatra\b/i }] }),
  framework('phoenix', 'Phoenix', { manifestPatterns: [{ files: ['mix.exs'], pattern: /\bphoenix\b/i }] }),
  framework('laravel', 'Laravel', { ecosystemDependencies: [{ ecosystem: 'composer', name: 'laravel/framework' }] }),
  framework('symfony', 'Symfony', { ecosystemDependencies: [{ ecosystem: 'composer', name: 'symfony/framework-bundle' }] }),
  framework('flutter', 'Flutter', { structuredManifest: 'flutter-sdk', manifestPatterns: [{ files: ['pubspec.yaml'], pattern: /^dependencies:\s*\n {2}flutter:\s*\n {4}sdk: flutter\s*$/m }] }),
  framework('vapor', 'Vapor', { manifestPatterns: [{ files: ['Package.swift'], pattern: /\bvapor\b/i }] }),

  runtime('nodejs', 'Node.js', { files: ['package.json'] }),
  runtime('bun', 'Bun', { files: ['bun.lock', 'bun.lockb', 'bunfig.toml'], dependencies: ['bun'] }),
  runtime('deno', 'Deno', { files: ['deno.json', 'deno.jsonc', 'deno.lock'] }),
  runtime('python', 'Python', { files: ['pyproject.toml', 'requirements.txt', 'setup.py', 'Pipfile', '.python-version'] }),
  runtime('jvm', 'JVM', { files: ['pom.xml', 'build.gradle', 'build.gradle.kts'] }),
  runtime('go', 'Go', { files: ['go.mod'] }),
  runtime('rust', 'Rust', { files: ['Cargo.toml'] }),
  runtime('ruby', 'Ruby', { files: ['Gemfile', '.ruby-version'] }),
  runtime('beam', 'BEAM', { files: ['mix.exs', 'rebar.config', 'rebar3'] }),
  runtime('dart', 'Dart', { files: ['pubspec.yaml'] }),
  runtime('swift', 'Swift', { files: ['Package.swift'] }),
  runtime('dotnet', '.NET', { structuredManifest: 'dotnet-sdk', pathPatterns: [/\.csproj$/i, /\.fsproj$/i, /\.sln$/i] }),

  { id: 'electron', name: 'Electron', kind: 'library', dependencies: ['electron', '@electron-forge/cli'], filePrefixes: ['electron-builder.'] },
  { id: 'vite', name: 'Vite', kind: 'build-tool', dependencies: ['vite'], filePrefixes: ['vite.config.'] },
  { id: 'vitest', name: 'Vitest', kind: 'testing', dependencies: ['vitest'], filePrefixes: ['vitest.config.'] },
  { id: 'jest', name: 'Jest', kind: 'testing', dependencies: ['jest'], filePrefixes: ['jest.config.'] },
  { id: 'playwright', name: 'Playwright', kind: 'testing', dependencies: ['@playwright/test', 'playwright'], filePrefixes: ['playwright.config.'] },
  { id: 'tailwind', name: 'Tailwind CSS', kind: 'styling', dependencies: ['tailwindcss'], filePrefixes: ['tailwind.config.'] },
  { id: 'prisma', name: 'Prisma', kind: 'orm', dependencies: ['prisma', '@prisma/client'], files: ['schema.prisma'] },
  { id: 'docker', name: 'Docker', kind: 'container', files: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'] },
  { id: 'github-actions', name: 'GitHub Actions', kind: 'ci-cd', pathPatterns: [/(^|\/)\.github\/workflows\/[^/]+\.ya?ml$/i] },
  { id: 'vercel', name: 'Vercel', kind: 'cloud', files: ['vercel.json'] },
] as const;

export function validateTechnologyRegistry(registry: readonly TechnologyDefinition[] = TECHNOLOGY_REGISTRY): string[] {
  const errors: string[] = []; const ids = new Set<string>();
  for (const definition of registry) {
    if (ids.has(definition.id)) errors.push(`Duplicate technology id: ${definition.id}`);
    ids.add(definition.id);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(definition.id)) errors.push(`Invalid technology id: ${definition.id}`);
    if (!definition.name.trim()) errors.push(`Technology ${definition.id} has no display name`);
    if (definition.ecosystemDependencies?.length) continue;
    if (!definition.structuredManifest && !definition.dependencies?.length && !definition.files?.length && !definition.filePrefixes?.length && !definition.pathPatterns?.length && !definition.manifestPatterns?.length) errors.push(`Technology ${definition.id} has no detection signals`);
  }
  return errors;
}

const registryErrors = validateTechnologyRegistry();
if (registryErrors.length) throw new Error(`Invalid UCE technology registry: ${registryErrors.join('; ')}`);

function baseName(path: string): string { return normalizeProjectPath(path).split('/').pop() ?? path; }
function confidenceFrom(weights: number[]): number {
  const remaining = weights.reduce((value, weight) => value * (1 - weight / 100), 1);
  return Math.min(99, Math.round((1 - remaining) * 100));
}

export function detectRegisteredTechnologies(files: ProjectFile[]): TechnologyDetection[] {
  const evidenceFiles = files.filter(isProjectEvidenceFile);
  const dependencies = npmDeclarations(evidenceFiles);
  const identities = ecosystemIdentities(evidenceFiles);
  const imports = javascriptImportEvidence(evidenceFiles);
  const packageManifests = evidenceFiles.map(file => normalizeProjectPath(file.path)).filter(path => /(^|\/)(?:package\.json|pyproject\.toml|Cargo\.toml|go\.mod|composer\.json|pubspec\.yaml|pom\.xml)$/i.test(path));
  const ecosystemDependencies = collectEcosystemDependencies(evidenceFiles);
  const results: TechnologyDetection[] = [];

  for (const definition of TECHNOLOGY_REGISTRY) {
    const evidence: TechnologyDetection['evidence'] = [];
    for (const identity of identities) {
      if (definition.ecosystemDependencies?.some(signal => signal.ecosystem === identity.ecosystem && signal.name === identity.name))
        evidence.push({ kind: 'manifest', source: identity.file, description: `${identity.ecosystem} package identity ${identity.name} declared`, weight: 55 });
    }
    for (const dependency of ecosystemDependencies) {
      if (!definition.ecosystemDependencies?.some(signal => signal.ecosystem === dependency.ecosystem && signal.name === dependency.name)) continue;
      evidence.push({ kind: 'dependency', source: dependency.file, description: `${dependency.ecosystem} dependency ${dependency.name} declared`, weight: 55 });
    }
    for (const dependency of dependencies) {
      if (!definition.dependencies?.includes(dependency.name)) continue;
      evidence.push({ kind: dependency.identity ? 'manifest' : 'dependency', source: dependency.file, description: `${dependency.identity ? 'Package identity' : 'Dependency'} ${dependency.name}${dependency.version ? ' ' + dependency.version : ''} declared`, weight: 55 });
      const lock = npmLockCorroborates(evidenceFiles, dependency);
      if (lock) evidence.push({ kind: 'manifest', source: lock, description: `${dependency.name} declaration corroborated by package-local lock entry`, weight: 30 });
    }
    for (const item of imports) {
      if (definition.dependencies?.includes(item.name)) evidence.push({ kind: 'import', source: item.file, description: `AST literal import of ${item.name}`, weight: 45 });
    }
    for (const file of evidenceFiles) {
      const path = normalizeProjectPath(file.path); const base = baseName(path);
      if (definition.files?.some((candidate) => candidate.includes('/') ? path.endsWith(candidate) : base.toLowerCase() === candidate.toLowerCase())) {
        evidence.push({ kind: 'file', source: path, description: `${base} marker found`, weight: 45 });
      }
      if (definition.filePrefixes?.some((prefix) => prefix.includes('/') ? path.startsWith(prefix) : base.toLowerCase().startsWith(prefix.toLowerCase()))) {
        evidence.push({ kind: 'configuration', source: path, description: `${base} configuration found`, weight: 45 });
      }
      if (definition.pathPatterns?.some((candidate) => new RegExp(candidate.source, candidate.flags.replace('g', '')).test(path))) {
        evidence.push({ kind: 'file', source: path, description: `${base} technology marker found`, weight: 45 });
      }
      if (definition.structuredManifest === 'dotnet-sdk' && base === 'global.json' && hasDotnetSdk(file.content ?? ''))
        evidence.push({ kind: 'manifest', source: path, description: '.NET SDK version declared in global.json', weight: 55 });
      if (definition.structuredManifest === 'flutter-sdk' && base === 'pubspec.yaml' && hasFlutterSdk(file.content ?? ''))
        evidence.push({ kind: 'manifest', source: path, description: 'Flutter SDK dependency declared in pubspec.yaml', weight: 55 });
      for (const signature of definition.structuredManifest ? [] : definition.manifestPatterns ?? []) {
        if (!signature.files.some((candidate) => base.toLowerCase() === candidate.toLowerCase()) || !file.content) continue;
        const pattern = new RegExp(signature.pattern.source, signature.pattern.flags.replace('g', ''));
        if (pattern.test(file.content)) evidence.push({ kind: 'manifest', source: path, description: `${definition.name} signature found in ${base}`, weight: 55 });
      }
    }
    if (!evidence.length) continue;
    const deduped = Array.from(new Map(evidence.map((item) => [`${item.kind}|${item.source}|${item.description}`, item])).values());
    // Repeating the same marker in many workspaces is not independent evidence.
    const byOwner = new Map<string, Map<string, number>>();
    for (const item of deduped) {
      const owner = packageOwner(item.source, packageManifests);
      const kinds = byOwner.get(owner) ?? new Map<string, number>();
      kinds.set(item.kind, Math.max(kinds.get(item.kind) ?? 0, item.weight));
      byOwner.set(owner, kinds);
    }
    const confidence = Math.max(...[...byOwner.values()].map(kinds => confidenceFrom([...kinds.values()])));
    results.push({ id: definition.id, name: definition.name, kind: definition.kind, confidence, level: confidence >= 80 ? 'confirmed' : confidence >= 50 ? 'likely' : 'possible', evidence: deduped.slice(0, 8) });
  }
  return results.sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));
}
