import type { ArchitectureIntelligence, ArchitectureType, DependencyIntelligence, DependencyItem, DetectedFile, ProjectFile, TechnologyEvidence, TechnologyKind, TechnologyStack } from './types';

function read(files: ProjectFile[], names: string[]): string {
  return names.map((name) => files.find((f) => !f.isDirectory && (f.path === name || f.path.endsWith('/' + name)))?.content ?? '').join('\n');
}

function has(files: ProjectFile[] | DetectedFile[], names: string[]): string | undefined {
  return names.find((name) => files.some((f) => f.path === name || f.path.endsWith('/' + name)));
}

function addEvidence(out: TechnologyEvidence[], name: string, kind: TechnologyKind, confidence: number, evidence: string[], version?: string): void {
  if (!evidence.length || out.some((item) => item.name === name && item.kind === kind)) return;
  out.push({ name, kind, confidence: Math.max(0, Math.min(100, confidence)), evidence, version });
}

function packageJson(files: ProjectFile[]): Record<string, unknown> | null {
  const text = read(files, ['package.json']);
  if (!text) return null;
  try { return JSON.parse(text) as Record<string, unknown>; } catch { return null; }
}

function dependencyMaps(files: ProjectFile[]): DependencyItem[] {
  const pkg = packageJson(files);
  if (!pkg) return [];
  const result: DependencyItem[] = [];
  const sections: Array<[string, DependencyItem['type']]> = [
    ['dependencies', 'runtime'], ['devDependencies', 'development'], ['peerDependencies', 'peer'], ['optionalDependencies', 'optional'],
  ];
  for (const [section, type] of sections) {
    const values = pkg[section];
    if (!values || typeof values !== 'object') continue;
    for (const [name, version] of Object.entries(values as Record<string, unknown>)) {
      if (typeof version === 'string') result.push({ name, version, type });
    }
  }
  return result;
}

function detectDependencyIntelligence(files: ProjectFile[], stack: TechnologyStack): DependencyIntelligence {
  const items = dependencyMaps(files);
  const allByName = new Map<string, string[]>();
  for (const item of items) allByName.set(item.name, [...(allByName.get(item.name) ?? []), item.version]);
  const duplicateNames = [...allByName.entries()].filter(([, versions]) => versions.length > 1).map(([name]) => name);
  const versionConflicts = [...allByName.entries()].filter(([, versions]) => new Set(versions).size > 1).map(([name, versions]) => `${name}: ${[...new Set(versions)].join(' vs ')}`);
  const healthScore = Math.max(0, Math.min(100, 100 - duplicateNames.length * 5 - versionConflicts.length * 12));
  return {
    manager: stack.packageManager,
    total: items.length,
    runtime: items.filter((x) => x.type === 'runtime').length,
    development: items.filter((x) => x.type === 'development').length,
    peer: items.filter((x) => x.type === 'peer').length,
    optional: items.filter((x) => x.type === 'optional').length,
    dependencies: items.slice(0, 120),
    duplicateNames,
    versionConflicts,
    healthScore,
  };
}

function detectArchitecture(files: ProjectFile[], detectedFiles: DetectedFile[], stack: TechnologyStack): ArchitectureIntelligence {
  const evidence: string[] = [];
  const patterns: ArchitectureType[] = [];
  const paths = files.filter((f) => !f.isDirectory).map((f) => f.path.toLowerCase());
  const hasAny = (parts: string[]) => paths.some((path) => parts.some((part) => path.includes(part)));
  const add = (pattern: ArchitectureType, reason: string) => { if (!patterns.includes(pattern)) patterns.push(pattern); evidence.push(reason); };

  if (stack.monorepo && stack.monorepo !== 'None') add('Monorepo', `${stack.monorepo} workspace configuration detected.`);
  if (stack.framework === 'Flutter' || (hasAny(['android/', 'ios/']) && paths.some((p) => p.endsWith('pubspec.yaml')))) add('Mobile App', 'Flutter/mobile project markers detected.');
  if (['Next.js', 'Nuxt', 'SvelteKit', 'Remix'].includes(stack.framework)) add('SSR', `${stack.framework} server-rendering capable application detected.`);
  if (stack.buildTool === 'Vite' && stack.frontend !== 'None' && stack.frontend !== 'Unknown') add('SPA', `Vite + ${stack.frontend} frontend markers detected.`);
  if (stack.buildTool === 'Astro' || stack.framework === 'Astro' || stack.buildTool === 'Gatsby') add('SSG', 'Static-site generation tooling detected.');
  if (stack.backend !== 'None' && stack.backend !== 'Unknown') add('API Server', `${stack.backend} backend framework detected.`);
  if (hasAny(['/api/', '/routes/', '/controllers/', 'server/', 'api/']) && stack.frontend !== 'None' && stack.frontend !== 'Unknown') add('Frontend + Backend', 'Frontend and server/API directory patterns detected.');
  if (has(detectedFiles, ['Dockerfile', 'docker-compose.yml', 'compose.yml'])) add('API Server', 'Container/deployment files indicate a server-capable application.');
  if (hasAny(['bin/', 'cmd/']) || paths.some((p) => p.endsWith('/main.go'))) add('CLI', 'CLI-oriented bin/cmd or executable entrypoint structure detected.');
  if (hasAny(['index.d.ts']) && paths.some((p) => p.endsWith('package.json'))) add('Library', 'Package entrypoint and TypeScript declaration markers detected.');
  if (!patterns.length) add('Unknown', 'No strong architecture pattern matched the available project evidence.');

  const priority: ArchitectureType[] = ['Frontend + Backend', 'SSR', 'SSG', 'SPA', 'API Server', 'Mobile App', 'Desktop App', 'Library', 'Monorepo', 'CLI', 'Unknown'];
  const primary = priority.find((item) => patterns.includes(item)) ?? patterns[0];
  const confidence = primary === 'Unknown' ? 35 : Math.min(98, 65 + Math.max(0, evidence.length - 1) * 7);
  return { primary, patterns, confidence, evidence: [...new Set(evidence)].slice(0, 8) };
}

export function detectTechnologyIntelligence(files: ProjectFile[], detectedFiles: DetectedFile[], stack: TechnologyStack): { evidence: TechnologyEvidence[]; dependencies: DependencyIntelligence; architecture: ArchitectureIntelligence } {
  const evidence: TechnologyEvidence[] = [];
  const deps = dependencyMaps(files);
  const depNames = new Set(deps.map((item) => item.name));
  const pkgText = read(files, ['package.json']);
  const addDep = (name: string, kind: TechnologyKind, confidence: number, reason: string, aliases: string[] = []) => {
    const matched = [name, ...aliases].find((item) => depNames.has(item));
    if (!matched) return;
    const version = deps.find((item) => item.name === matched)?.version;
    addEvidence(evidence, name, kind, confidence, [`package.json dependency: ${matched}`, reason], version);
  };

  for (const framework of stack.frameworks ?? [stack.framework]) if (framework !== 'Unknown') addEvidence(evidence, framework, 'framework', 96, [`Framework detector matched: ${framework}`]);
  for (const runtime of stack.runtimes ?? [stack.runtime]) if (runtime !== 'Unknown') addEvidence(evidence, runtime, 'runtime', 95, [`Runtime detector matched: ${runtime}`]);
  if (stack.database !== 'Unknown' && stack.database !== 'Detected') addEvidence(evidence, stack.database, 'database', 90, ['Database detector matched project configuration.']);
  if (stack.packageManager !== 'Unknown') addEvidence(evidence, stack.packageManager, 'package-manager', 98, [`Detected package manager: ${stack.packageManager}`]);
  if (stack.buildTool !== 'Unknown') addEvidence(evidence, stack.buildTool, 'build-tool', 96, [`Detected build tool: ${stack.buildTool}`]);
  if (stack.cloudProvider && stack.cloudProvider !== 'None') addEvidence(evidence, stack.cloudProvider, 'cloud', 90, ['Deployment configuration marker detected.']);

  addDep('React Router', 'api', 94, 'Routing library detected.', ['react-router', 'react-router-dom']);
  addDep('TanStack Query', 'api', 94, 'Server-state/query library detected.', ['@tanstack/react-query']);
  addDep('Axios', 'api', 92, 'HTTP client dependency detected.', ['axios']);
  addDep('Zod', 'library', 94, 'Runtime schema validation library detected.', ['zod']);
  addDep('Zustand', 'library', 92, 'State-management library detected.', ['zustand']);
  addDep('Tailwind CSS', 'styling', 96, 'Utility-first CSS framework detected.', ['tailwindcss']);
  addDep('Radix UI', 'library', 94, 'Accessible UI primitives detected.', ['@radix-ui/react-dialog', '@radix-ui/react-slot']);
  addDep('Prisma', 'orm', 96, 'Prisma ORM dependency detected.', ['prisma', '@prisma/client']);
  addDep('Drizzle ORM', 'orm', 96, 'Drizzle ORM dependency detected.', ['drizzle-orm']);
  addDep('Vitest', 'testing', 96, 'Vitest test runner detected.', ['vitest']);
  addDep('Jest', 'testing', 96, 'Jest test runner detected.', ['jest']);
  addDep('Playwright', 'testing', 96, 'Browser E2E testing dependency detected.', ['@playwright/test']);
  addDep('Cypress', 'testing', 96, 'Browser E2E testing dependency detected.', ['cypress']);
  addDep('ESLint', 'linting', 96, 'ESLint dependency detected.', ['eslint']);
  addDep('Prettier', 'linting', 94, 'Prettier formatter dependency detected.', ['prettier']);

  if (pkgText && /"scripts"[\s\S]*"test"\s*:/i.test(pkgText)) addEvidence(evidence, 'npm test script', 'testing', 72, ['package.json contains a test script.']);
  if (has(detectedFiles, ['.github/workflows/ci.yml', '.github/workflows/ci.yaml'])) addEvidence(evidence, 'GitHub Actions', 'ci-cd', 98, ['.github/workflows CI configuration detected.']);
  if (has(detectedFiles, ['Dockerfile'])) addEvidence(evidence, 'Docker', 'container', 99, ['Dockerfile detected.']);
  if (has(detectedFiles, ['docker-compose.yml', 'compose.yml'])) addEvidence(evidence, 'Docker Compose', 'container', 99, ['Compose configuration detected.']);
  if (has(detectedFiles, ['.env.example', '.env.local.example'])) addEvidence(evidence, 'Environment configuration', 'configuration', 90, ['Example environment configuration detected.']);
  if (has(detectedFiles, ['.prettierrc', '.prettierrc.json', 'prettier.config.js', 'prettier.config.cjs'])) addEvidence(evidence, 'Prettier', 'linting', 98, ['Prettier configuration detected.']);
  if (has(detectedFiles, ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts'])) addEvidence(evidence, 'ESLint', 'linting', 98, ['ESLint flat configuration detected.']);

  const python = read(files, ['requirements.txt', 'pyproject.toml', 'Pipfile']);
  if (/pytest/i.test(python) || has(detectedFiles, ['pytest.ini', 'conftest.py'])) addEvidence(evidence, 'pytest', 'testing', 96, ['Python test runner marker detected.']);
  if (/sqlalchemy/i.test(python)) addEvidence(evidence, 'SQLAlchemy', 'orm', 96, ['SQLAlchemy dependency detected.']);
  const java = read(files, ['pom.xml', 'build.gradle', 'build.gradle.kts']);
  if (/junit/i.test(java)) addEvidence(evidence, 'JUnit', 'testing', 96, ['JUnit dependency/configuration detected.']);
  if (has(detectedFiles, ['pom.xml'])) addEvidence(evidence, 'Maven', 'build-tool', 98, ['pom.xml detected.']);
  if (has(detectedFiles, ['build.gradle', 'build.gradle.kts'])) addEvidence(evidence, 'Gradle', 'build-tool', 98, ['Gradle build file detected.']);
  if (has(detectedFiles, ['Cargo.toml'])) addEvidence(evidence, 'Cargo', 'package-manager', 98, ['Cargo.toml detected.']);
  if (has(detectedFiles, ['go.mod'])) addEvidence(evidence, 'Go modules', 'package-manager', 98, ['go.mod detected.']);

  return {
    evidence: evidence.sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name)),
    dependencies: detectDependencyIntelligence(files, stack),
    architecture: detectArchitecture(files, detectedFiles, stack),
  };
}
