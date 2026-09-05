import type { DetectedFile, Framework, ProjectFile, Runtime, TechnologyStack } from './types';

function hasFile(files: DetectedFile[] | ProjectFile[], name: string): boolean {
  return files.some((f) => f.path === name || f.path.endsWith('/' + name));
}

function readFileText(files: ProjectFile[], target: string): string | null {
  const matches = files.filter((f) => !f.isDirectory && (f.path === target || f.path.endsWith('/' + target)));
  if (matches.length === 0) return null;
  matches.sort((a, b) => a.path.length - b.path.length);
  return matches[0].content ?? null;
}

function packageDependencies(files: ProjectFile[]): Set<string> {
  const pkg = readFileText(files, 'package.json');
  if (!pkg) return new Set();
  try {
    const json = JSON.parse(pkg) as Record<string, unknown>;
    return new Set([
      ...Object.keys((json.dependencies as Record<string, unknown> | undefined) ?? {}),
      ...Object.keys((json.devDependencies as Record<string, unknown> | undefined) ?? {}),
      ...Object.keys((json.peerDependencies as Record<string, unknown> | undefined) ?? {}),
    ]);
  } catch {
    return new Set();
  }
}

function addIfDependency(out: Framework[], deps: Set<string>, name: string, framework: Framework): void {
  if (deps.has(name) && !out.includes(framework)) out.push(framework);
}

/**
 * Detect every credible framework/runtime present in a project, while keeping
 * detectStack() as the source of the legacy single primary values.
 */
export function detectTechnologyProfiles(
  files: ProjectFile[],
  detectedFiles: DetectedFile[],
  stack: TechnologyStack,
): { frameworks: Framework[]; runtimes: Runtime[] } {
  const frameworks: Framework[] = [];
  const runtimes: Runtime[] = [];
  const deps = packageDependencies(files);

  const addFramework = (framework: Framework) => {
    if (!frameworks.includes(framework)) frameworks.push(framework);
  };
  const addRuntime = (runtime: Runtime) => {
    if (!runtimes.includes(runtime)) runtimes.push(runtime);
  };

  // JavaScript / TypeScript ecosystem.
  if (hasFile(detectedFiles, 'next.config.js') || hasFile(detectedFiles, 'next.config.mjs') || deps.has('next')) addFramework('Next.js');
  if (hasFile(detectedFiles, 'nuxt.config.ts') || hasFile(detectedFiles, 'nuxt.config.js') || deps.has('nuxt')) addFramework('Nuxt');
  if (hasFile(detectedFiles, 'astro.config.ts') || hasFile(detectedFiles, 'astro.config.mjs') || deps.has('astro')) addFramework('Astro');
  if (hasFile(detectedFiles, 'remix.config.js') || deps.has('@remix-run/react')) addFramework('Remix');
  if (hasFile(detectedFiles, 'gatsby.config.js') || deps.has('gatsby')) addFramework('Gatsby');
  if (hasFile(detectedFiles, 'angular.json') || deps.has('@angular/core')) addFramework('Angular');
  if (hasFile(detectedFiles, 'svelte.config.js') || hasFile(detectedFiles, 'svelte.config.mjs') || deps.has('svelte')) {
    addFramework(deps.has('@sveltejs/kit') ? 'SvelteKit' : 'Svelte');
  }
  addIfDependency(frameworks, deps, 'react', 'React');
  addIfDependency(frameworks, deps, 'vue', 'Vue');
  addIfDependency(frameworks, deps, 'solid-js', 'Solid');
  addIfDependency(frameworks, deps, '@builder.io/qwik', 'Qwik');
  addIfDependency(frameworks, deps, 'preact', 'Preact');
  addIfDependency(frameworks, deps, 'alpinejs', 'Alpine.js');
  addIfDependency(frameworks, deps, 'lit', 'Lit');
  addIfDependency(frameworks, deps, '@stencil/core', 'Stencil');
  addIfDependency(frameworks, deps, 'express', 'Express');
  addIfDependency(frameworks, deps, 'nestjs', 'NestJS');
  addIfDependency(frameworks, deps, '@nestjs/core', 'NestJS');
  addIfDependency(frameworks, deps, 'fastify', 'Fastify');
  addIfDependency(frameworks, deps, 'hono', 'Hono');
  if (deps.size > 0 || hasFile(detectedFiles, 'package.json')) addRuntime('Node.js');
  if (deps.has('bun') || hasFile(detectedFiles, 'bun.lock') || hasFile(detectedFiles, 'bun.lockb')) addRuntime('Bun');
  if (hasFile(detectedFiles, 'deno.json') || hasFile(detectedFiles, 'deno.jsonc')) addRuntime('Deno');

  // Python ecosystem.
  const req = readFileText(files, 'requirements.txt') ?? '';
  const pyproject = readFileText(files, 'pyproject.toml') ?? '';
  const pythonText = `${req}\n${pyproject}`;
  if (/\bDjango\b/i.test(pythonText) || /django/i.test(pythonText)) addFramework('Django');
  if (/\bFlask\b/i.test(pythonText) || /flask/i.test(pythonText)) addFramework('Flask');
  if (/\bfastapi\b/i.test(pythonText)) addFramework('FastAPI');
  if (hasFile(detectedFiles, 'requirements.txt') || hasFile(detectedFiles, 'pyproject.toml') || hasFile(detectedFiles, 'setup.py') || hasFile(detectedFiles, '.python-version')) addRuntime('Python');

  // JVM.
  const gradle = (readFileText(files, 'build.gradle') ?? '') + '\n' + (readFileText(files, 'build.gradle.kts') ?? '');
  const pom = readFileText(files, 'pom.xml') ?? '';
  if (/org\.springframework|spring-boot/i.test(`${gradle}\n${pom}`)) addFramework('Spring Boot');
  if (/io\.quarkus|quarkus/i.test(`${gradle}\n${pom}`)) addFramework('Quarkus');
  if (/io\.ktor|ktor/i.test(gradle)) addFramework('Ktor');
  if (/io\.micronaut|micronaut/i.test(gradle)) addFramework('Micronaut');
  if (/playframework|play\.api/i.test(`${gradle}\n${pom}`)) addFramework('Play Framework');
  if (hasFile(detectedFiles, 'pom.xml') || hasFile(detectedFiles, 'build.gradle') || hasFile(detectedFiles, 'build.gradle.kts')) addRuntime('JVM');

  // Go, Rust, Ruby, Elixir, Dart, Swift and .NET runtimes.
  if (hasFile(detectedFiles, 'go.mod')) addRuntime('Go');
  if (hasFile(detectedFiles, 'Cargo.toml')) addRuntime('Rust');
  if (hasFile(detectedFiles, 'Gemfile') || hasFile(detectedFiles, '.ruby-version')) addRuntime('Ruby');
  if (hasFile(detectedFiles, 'mix.exs')) addRuntime('BEAM');
  if (hasFile(detectedFiles, 'pubspec.yaml')) addRuntime('Dart');
  if (hasFile(detectedFiles, 'Package.swift')) addRuntime('Swift');
  if (hasFile(detectedFiles, 'packages.config') || files.some((f) => !f.isDirectory && f.path.toLowerCase().endsWith('.csproj'))) addRuntime('.NET');

  // Keep primary legacy detections visible even if a project uses unusual config naming.
  if (stack.framework !== 'Unknown' && !frameworks.includes(stack.framework)) frameworks.unshift(stack.framework);
  if (stack.runtime !== 'Unknown' && !runtimes.includes(stack.runtime)) runtimes.unshift(stack.runtime);

  return { frameworks, runtimes };
}
