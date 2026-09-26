import { pythonDependencies, pythonMetadataValue } from './python-evidence';
import type { ArchitectureIntelligence, ArchitectureType, DependencyIntelligence, DependencyItem, DependencyRisk, DetectedFile, ProjectFile, TechnologyEvidence, TechnologyKind, TechnologyStack } from './types';
import { isProjectEvidenceFile } from './project-scope';

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

function dependencyMaps(files: ProjectFile[]): DependencyItem[] {
  const result: DependencyItem[] = [];
  const sections: Array<[string, DependencyItem['type']]> = [
    ['dependencies', 'runtime'], ['devDependencies', 'development'], ['peerDependencies', 'peer'], ['optionalDependencies', 'optional'],
  ];
  for (const file of files.filter((item) => isProjectEvidenceFile(item) && /(^|\/)package\.json$/i.test(item.path) && item.content)) {
    let pkg: Record<string, unknown>; try { pkg = JSON.parse(file.content!) as Record<string, unknown>; } catch { continue; }
    for (const [section, type] of sections) {
      const values = pkg[section]; if (!values || typeof values !== 'object') continue;
      for (const [name, version] of Object.entries(values as Record<string, unknown>)) if (typeof version === 'string') result.push({ name, version, type, source: file.path });
    }
  }
  for (const file of files.filter(item => isProjectEvidenceFile(item) && /(?:^|\/)pyproject\.toml$/i.test(item.path))) {
    result.push(...pythonDependencies(file.content ?? '').map(item => ({ ...item, source: file.path })));
  }
  return result;
}

export function detectDependencyIntelligence(files: ProjectFile[], stack: TechnologyStack): DependencyIntelligence {
  const items = dependencyMaps(files);
  const allByName = new Map<string, string[]>();
  for (const item of items.filter(item => /(?:^|\/)package\.json$/i.test(item.source ?? ''))) allByName.set(item.name, [...(allByName.get(item.name) ?? []), item.version]);
  const duplicateNames = [...allByName.entries()].filter(([, versions]) => versions.length > 1).map(([name]) => name);
  const versionConflicts = [...allByName.entries()].filter(([, versions]) => new Set(versions).size > 1).map(([name, versions]) => `${name}: ${[...new Set(versions)].join(' vs ')}`);
  const risks: DependencyRisk[] = [];
  for (const item of items) {
    if (/^(?:\*|latest|next)$/i.test(item.version)) risks.push({ name: item.name, version: item.version, source: item.source ?? 'package.json', kind: 'wildcard', severity: 'warning', recommendation: 'Pin a reviewed version range and commit the lockfile.' });
    else if (/^(?:https?:|git(?:\+|:)|github:)/i.test(item.version)) risks.push({ name: item.name, version: item.version, source: item.source ?? 'package.json', kind: 'remote-source', severity: 'warning', recommendation: 'Prefer a verified registry release or immutable commit digest.' });
  }
  for (const conflict of versionConflicts) risks.push({ name: conflict.split(':')[0], version: conflict, source: 'multiple package manifests', kind: 'version-conflict', severity: 'warning', recommendation: 'Align workspace dependency ranges to reduce inconsistent installations.' });
  const healthScore = Math.max(0, Math.min(100, 100 - versionConflicts.length * 12 - risks.filter((risk) => risk.kind !== 'version-conflict').length * 8));
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
    risks: risks.slice(0, 100),
    manifestsScanned: new Set(items.map((item) => item.source).filter(Boolean)).size,
    healthScore,
  };
}

function detectArchitecture(files: ProjectFile[], _detectedFiles: DetectedFile[], stack: TechnologyStack): ArchitectureIntelligence {
  const evidence: string[] = [];
  const patterns: ArchitectureType[] = [];
  const evidenceFiles = files.filter(isProjectEvidenceFile);
  const paths = evidenceFiles.map((f) => f.path.toLowerCase());
  const hasAny = (parts: string[]) => paths.some((path) => parts.some((part) => path.includes(part)));
  const add = (pattern: ArchitectureType, reason: string) => { if (!patterns.includes(pattern)) patterns.push(pattern); evidence.push(reason); };

  const hasRoot = (name: string) => evidenceFiles.some((file) => file.path === name);
  const under = (prefix: string) => paths.some((path) => path === prefix || path.startsWith(prefix + '/'));
  const kernelStructureSignals = ['arch', 'drivers', 'kernel', 'include/linux', 'mm', 'fs'].filter(under);
  if (hasRoot('Kconfig') && (hasRoot('Kbuild') || hasRoot('Makefile')) && kernelStructureSignals.length >= 3) {
    return { primary: 'Operating System Kernel', patterns: ['Operating System Kernel'], confidence: 99, evidence: ['Root Kconfig plus Kbuild/Makefile detected.', `Kernel source structure detected: ${kernelStructureSignals.join(', ')}.`, 'Generic application architecture heuristics were suppressed for this kernel project.'] };
  }

  const pythonProject = evidenceFiles.find(file => file.path === 'pyproject.toml')?.content ?? '';
  const pythonModule = pythonMetadataValue(pythonProject, 'tool.flit.module', 'name') ?? pythonMetadataValue(pythonProject, 'project', 'name')?.replace(/-/g, '_');
  const declaredSingleModule = pythonModule && /^[A-Za-z_]\w*$/.test(pythonModule) && (hasRoot(`${pythonModule}.py`) || hasRoot(`src/${pythonModule}.py`));
  if (/\[build-system\]/.test(pythonProject) && (declaredSingleModule || paths.some(path => /(?:^|\/)__init__\.py$/.test(path)))) add('Library', 'Python package or declared single-file module and build-system metadata detected.');
  if (stack.monorepo && stack.monorepo !== 'None') add('Monorepo', `${stack.monorepo} workspace configuration detected.`);
  const dependencies = new Set(dependencyMaps(files).map((item) => item.name));
  if (dependencies.has('electron') || dependencies.has('@electron-forge/cli') || hasAny(['electron/', 'electron-builder.'])) add('Desktop App', 'Electron dependency or desktop application markers detected.');
  if (stack.framework === 'Flutter' || (hasAny(['android/', 'ios/']) && paths.some((p) => p.endsWith('pubspec.yaml')))) add('Mobile App', 'Flutter/mobile project markers detected.');
  if (['Next.js', 'Nuxt', 'SvelteKit', 'Remix'].includes(stack.framework)) add('SSR', `${stack.framework} server-rendering capable application detected.`);
  if (stack.buildTool === 'Vite' && stack.frontend !== 'None' && stack.frontend !== 'Unknown') add('SPA', `Vite + ${stack.frontend} frontend markers detected.`);
  if (stack.buildTool === 'Astro' || stack.framework === 'Astro' || stack.buildTool === 'Gatsby') add('SSG', 'Static-site generation tooling detected.');
  if (stack.backend !== 'None' && stack.backend !== 'Unknown') add('API Server', `${stack.backend} backend framework detected.`);
  if (hasAny(['/api/', '/routes/', '/controllers/', 'server/', 'api/']) && stack.frontend !== 'None' && stack.frontend !== 'Unknown') add('Frontend + Backend', 'Frontend and server/API directory patterns detected.');
  if (hasAny(['bin/', 'cmd/']) || paths.some((p) => p.endsWith('/main.go'))) add('CLI', 'CLI-oriented bin/cmd or executable entrypoint structure detected.');
  if (hasAny(['index.d.ts']) && paths.some((p) => p.endsWith('package.json'))) add('Library', 'Package entrypoint and TypeScript declaration markers detected.');
  const manifestCount = paths.filter((path) => /(?:^|\/)(?:package\.json|pyproject\.toml|pom\.xml|go\.mod|cargo\.toml)$/.test(path)).length;
  const serviceRoots = new Set(paths.flatMap((path) => { const match = /(?:^|\/)(?:services|apps)\/([^/]+)\/(?:package\.json|pyproject\.toml|pom\.xml|go\.mod|cargo\.toml)$/.exec(path); return match ? [match[1]] : []; }));
  if (serviceRoots.size >= 3) add('Microservices', `${serviceRoots.size} independently manifested service/application roots detected.`);
  if (has(evidenceFiles, ['serverless.yml', 'serverless.yaml', 'sam.yaml', 'template.yaml']) || hasAny(['functions/', 'lambdas/'])) add('Serverless', 'Serverless deployment configuration or function directories detected.');
  if ([...dependencies].some((name) => /kafka|rabbitmq|amqplib|nats|bullmq|eventemitter/i.test(name)) || hasAny(['events/', 'consumers/', 'producers/'])) add('Event-driven', 'Message broker dependencies or event producer/consumer structure detected.');
  if (hasAny(['domain/']) && hasAny(['adapters/', 'ports/', 'use-cases/', 'usecases/'])) add('Clean/Hexagonal', 'Domain, port, adapter, or use-case boundaries detected.');
  if (['models/', 'views/', 'controllers/'].every(marker => hasAny([marker]))) add('MVC', 'Model, view, and controller directory markers detected.');
  if (hasAny(['viewmodels/', 'view-models/'])) add('MVVM', 'View-model directory structure detected.');
  if ([...dependencies].some((name) => /single-spa|module-federation/i.test(name)) || paths.some((path) => /modulefederation|module-federation/i.test(path))) add('Microfrontend', 'Module federation or single-spa markers detected.');
  if (hasAny(['plugins/', 'extensions/']) && hasAny(['plugin-api', 'plugin.json', 'extension.json'])) add('Plugin Architecture', 'Plugin/extension modules and a plugin contract were detected.');
  if (hasAny(['service-worker', 'serviceworker', 'workbox', 'manifest.webmanifest']) || dependencies.has('workbox')) add('Offline-first', 'Service-worker, Workbox, or web-app manifest markers detected.');
  if (hasAny(['workers/', '.worker.', 'background-jobs/', 'queues/'])) add('Background Workers', 'Worker, queue, or background-job modules detected.');
  if (has(evidenceFiles, ['Dockerfile', 'docker-compose.yml', 'compose.yml']) || hasAny(['k8s/', 'kubernetes/', 'helm/'])) add('Containerized Application', 'Docker or Kubernetes deployment evidence detected.');
  if (!patterns.includes('Microservices') && !patterns.includes('Monorepo') && manifestCount >= 2 && hasAny(['modules/', 'packages/'])) add('Modular Monolith', 'Multiple internal modules share a single repository deployment boundary.');
  if (!patterns.length) add('Unknown', 'No strong architecture pattern matched the available project evidence.');

  const priority: ArchitectureType[] = ['Microservices', 'Serverless', 'Desktop App', 'Mobile App', 'Frontend + Backend', 'SSR', 'SSG', 'SPA', 'API Server', 'Modular Monolith', 'Event-driven', 'Library', 'Monorepo', 'CLI', 'Unknown'];
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
