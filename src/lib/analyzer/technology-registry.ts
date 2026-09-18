import type { ProjectFile, TechnologyDetection, TechnologyKind } from './types';
import { TECHNOLOGY_KNOWLEDGE } from './technology-knowledge';
import { ECOSYSTEM_KNOWLEDGE } from './ecosystem-knowledge';
import { collectEcosystemDependencies, type Ecosystem } from './ecosystem-dependencies';
import { classifyProjectFileScope, isProjectEvidenceFile, normalizeProjectPath } from './project-scope';

export interface TechnologyDefinition {
  id: string;
  name: string;
  kind: TechnologyKind;
  dependencies?: string[];
  ecosystemDependencies?: Array<{ ecosystem: Ecosystem; name: string }>;
  files?: string[];
  filePrefixes?: string[];
  pathPatterns?: RegExp[];
  manifestPatterns?: Array<{ files: string[]; pattern: RegExp }>;
}

const framework = (id: string, name: string, definition: Omit<TechnologyDefinition, 'id' | 'name' | 'kind'>): TechnologyDefinition => ({ id, name, kind: 'framework', ...definition });
const runtime = (id: string, name: string, definition: Omit<TechnologyDefinition, 'id' | 'name' | 'kind'>): TechnologyDefinition => ({ id, name, kind: 'runtime', ...definition });

/** Versioned knowledge registry. Adding a technology must not require detector changes. */
export const TECHNOLOGY_REGISTRY_VERSION = '2.1.0';
export const TECHNOLOGY_REGISTRY: readonly TechnologyDefinition[] = [
  ...TECHNOLOGY_KNOWLEDGE,
  ...ECOSYSTEM_KNOWLEDGE,
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
  framework('django', 'Django', { manifestPatterns: [{ files: ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py', 'setup.cfg'], pattern: /\bdjango\b/i }] }),
  framework('flask', 'Flask', { manifestPatterns: [{ files: ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py', 'setup.cfg'], pattern: /\bflask\b/i }] }),
  framework('fastapi', 'FastAPI', { manifestPatterns: [{ files: ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py', 'setup.cfg'], pattern: /\bfastapi\b/i }] }),
  framework('spring-boot', 'Spring Boot', { manifestPatterns: [{ files: ['pom.xml', 'build.gradle', 'build.gradle.kts'], pattern: /spring-boot|org\.springframework/i }] }),
  framework('quarkus', 'Quarkus', { manifestPatterns: [{ files: ['pom.xml', 'build.gradle', 'build.gradle.kts'], pattern: /quarkus|io\.quarkus/i }] }),
  framework('ktor', 'Ktor', { manifestPatterns: [{ files: ['build.gradle', 'build.gradle.kts'], pattern: /ktor|io\.ktor/i }] }),
  framework('micronaut', 'Micronaut', { manifestPatterns: [{ files: ['pom.xml', 'build.gradle', 'build.gradle.kts'], pattern: /micronaut|io\.micronaut/i }] }),
  framework('play', 'Play Framework', { manifestPatterns: [{ files: ['pom.xml', 'build.sbt'], pattern: /playframework|com\.typesafe\.play|play\.api/i }] }),
  framework('gin', 'Gin', { manifestPatterns: [{ files: ['go.mod'], pattern: /gin-gonic\/gin/i }] }),
  framework('fiber', 'Fiber', { manifestPatterns: [{ files: ['go.mod'], pattern: /gofiber\/fiber/i }] }),
  framework('echo', 'Echo', { manifestPatterns: [{ files: ['go.mod'], pattern: /labstack\/echo/i }] }),
  framework('chi', 'Chi', { manifestPatterns: [{ files: ['go.mod'], pattern: /go-chi\/chi/i }] }),
  framework('revel', 'Revel', { manifestPatterns: [{ files: ['go.mod'], pattern: /revel\/revel/i }] }),
  framework('actix', 'Actix', { manifestPatterns: [{ files: ['Cargo.toml'], pattern: /actix-web/i }] }),
  framework('axum', 'Axum', { manifestPatterns: [{ files: ['Cargo.toml'], pattern: /\baxum\b/i }] }),
  framework('rocket', 'Rocket', { manifestPatterns: [{ files: ['Cargo.toml'], pattern: /\brocket\b/i }] }),
  framework('rails', 'Rails', { manifestPatterns: [{ files: ['Gemfile', 'gems.rb'], pattern: /\brails\b/i }] }),
  framework('sinatra', 'Sinatra', { manifestPatterns: [{ files: ['Gemfile', 'gems.rb'], pattern: /\bsinatra\b/i }] }),
  framework('phoenix', 'Phoenix', { manifestPatterns: [{ files: ['mix.exs'], pattern: /\bphoenix\b/i }] }),
  framework('laravel', 'Laravel', { manifestPatterns: [{ files: ['composer.json'], pattern: /laravel\/framework/i }] }),
  framework('symfony', 'Symfony', { manifestPatterns: [{ files: ['composer.json'], pattern: /symfony\/framework-bundle/i }] }),
  framework('flutter', 'Flutter', { manifestPatterns: [{ files: ['pubspec.yaml'], pattern: /\bflutter\s*:/i }] }),
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
  runtime('dotnet', '.NET', { pathPatterns: [/\.csproj$/i, /\.fsproj$/i, /\.sln$/i] }),

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
    if (!definition.dependencies?.length && !definition.files?.length && !definition.filePrefixes?.length && !definition.pathPatterns?.length && !definition.manifestPatterns?.length) errors.push(`Technology ${definition.id} has no detection signals`);
  }
  return errors;
}

const registryErrors = validateTechnologyRegistry();
if (registryErrors.length) throw new Error(`Invalid UCE technology registry: ${registryErrors.join('; ')}`);

interface DependencyEvidence { name: string; file: string; }

function collectDependencies(files: ProjectFile[]): DependencyEvidence[] {
  const found: DependencyEvidence[] = [];
  for (const file of files) {
    if (file.isDirectory || !/(^|\/)package\.json$/i.test(file.path) || !file.content) continue;
    const scope = classifyProjectFileScope(file.path);
    if (scope === 'test' || scope === 'fixture' || scope === 'generated' || scope === 'vendor') continue;
    try {
      const parsed = JSON.parse(file.content) as Record<string, unknown>;
      for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
        const dependencies = parsed[section];
        if (!dependencies || typeof dependencies !== 'object') continue;
        for (const name of Object.keys(dependencies as Record<string, unknown>)) found.push({ name, file: normalizeProjectPath(file.path) });
      }
    } catch { /* Invalid manifests are reported by compatibility rules. */ }
  }
  return found;
}

function baseName(path: string): string { return normalizeProjectPath(path).split('/').pop() ?? path; }
function confidenceFrom(weights: number[]): number {
  const remaining = weights.reduce((value, weight) => value * (1 - weight / 100), 1);
  return Math.min(99, Math.round((1 - remaining) * 100));
}

export function detectRegisteredTechnologies(files: ProjectFile[]): TechnologyDetection[] {
  const evidenceFiles = files.filter(isProjectEvidenceFile);
  const dependencies = collectDependencies(evidenceFiles);
  const ecosystemDependencies = collectEcosystemDependencies(evidenceFiles);
  const results: TechnologyDetection[] = [];

  for (const definition of TECHNOLOGY_REGISTRY) {
    const evidence: TechnologyDetection['evidence'] = [];
    for (const dependency of ecosystemDependencies) {
      if (!definition.ecosystemDependencies?.some(signal => signal.ecosystem === dependency.ecosystem && signal.name === dependency.name)) continue;
      evidence.push({ kind: 'dependency', source: dependency.file, description: `${dependency.ecosystem} dependency ${dependency.name} declared`, weight: 55 });
    }
    for (const dependency of dependencies) {
      if (!definition.dependencies?.includes(dependency.name)) continue;
      evidence.push({ kind: 'dependency', source: dependency.file, description: `Dependency ${dependency.name} declared`, weight: 55 });
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
      for (const signature of definition.manifestPatterns ?? []) {
        if (!signature.files.some((candidate) => base.toLowerCase() === candidate.toLowerCase()) || !file.content) continue;
        const pattern = new RegExp(signature.pattern.source, signature.pattern.flags.replace('g', ''));
        if (pattern.test(file.content)) evidence.push({ kind: 'manifest', source: path, description: `${definition.name} signature found in ${base}`, weight: 55 });
      }
    }
    if (!evidence.length) continue;
    const deduped = Array.from(new Map(evidence.map((item) => [`${item.kind}|${item.source}|${item.description}`, item])).values());
    // Repeating the same marker in many workspaces is not independent evidence.
    const byKind = new Map<string, number>();
    for (const item of deduped) byKind.set(item.kind, Math.max(byKind.get(item.kind) ?? 0, item.weight));
    const confidence = confidenceFrom([...byKind.values()]);
    results.push({ id: definition.id, name: definition.name, kind: definition.kind, confidence, level: confidence >= 80 ? 'confirmed' : confidence >= 50 ? 'likely' : 'possible', evidence: deduped.slice(0, 8) });
  }
  return results.sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name));
}
