import type { DetectedFile, Framework, ProjectFile, Runtime, TechnologyStack } from './types';

function hasFile(files: DetectedFile[] | ProjectFile[], name: string): boolean {
  return files.some((f) => f.path === name || f.path.endsWith('/' + name));
}

function readFileText(files: ProjectFile[], target: string): string | null {
  const matches = files.filter((f) => !f.isDirectory && (f.path === target || f.path.endsWith('/' + target)));
  if (!matches.length) return null;
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
  } catch { return new Set(); }
}

function hasDependency(deps: Set<string>, ...names: string[]): boolean {
  return names.some((name) => deps.has(name));
}

function addUnique<T>(out: T[], value: T): void {
  if (!out.includes(value)) out.push(value);
}

function textOf(files: ProjectFile[], names: string[]): string {
  return names.map((name) => readFileText(files, name) ?? '').join('\n');
}

/** Evidence-based multi-technology detection. Legacy single values remain primary. */
export function detectTechnologyProfiles(
  files: ProjectFile[],
  detectedFiles: DetectedFile[],
  stack: TechnologyStack,
): { frameworks: Framework[]; runtimes: Runtime[] } {
  const frameworks: Framework[] = [];
  const runtimes: Runtime[] = [];
  const deps = packageDependencies(files);

  // JavaScript / TypeScript frameworks.
  if (hasDependency(deps, 'next') || hasFile(detectedFiles, 'next.config.js') || hasFile(detectedFiles, 'next.config.mjs') || hasFile(detectedFiles, 'next.config.ts')) addUnique(frameworks, 'Next.js');
  if (hasDependency(deps, 'nuxt') || hasFile(detectedFiles, 'nuxt.config.ts') || hasFile(detectedFiles, 'nuxt.config.js')) addUnique(frameworks, 'Nuxt');
  if (hasDependency(deps, 'astro') || hasFile(detectedFiles, 'astro.config.ts') || hasFile(detectedFiles, 'astro.config.mjs')) addUnique(frameworks, 'Astro');
  if (hasDependency(deps, '@remix-run/react', '@remix-run/node') || hasFile(detectedFiles, 'remix.config.js')) addUnique(frameworks, 'Remix');
  if (hasDependency(deps, 'gatsby') || hasFile(detectedFiles, 'gatsby-config.js')) addUnique(frameworks, 'Gatsby');
  if (hasDependency(deps, '@angular/core') || hasFile(detectedFiles, 'angular.json')) addUnique(frameworks, 'Angular');
  if (hasDependency(deps, '@sveltejs/kit')) addUnique(frameworks, 'SvelteKit');
  else if (hasDependency(deps, 'svelte') || hasFile(detectedFiles, 'svelte.config.js') || hasFile(detectedFiles, 'svelte.config.mjs')) addUnique(frameworks, 'Svelte');
  if (hasDependency(deps, 'react', 'react-dom')) addUnique(frameworks, 'React');
  if (hasDependency(deps, 'vue')) addUnique(frameworks, 'Vue');
  if (hasDependency(deps, 'solid-js')) addUnique(frameworks, 'Solid');
  if (hasDependency(deps, '@builder.io/qwik')) addUnique(frameworks, 'Qwik');
  if (hasDependency(deps, 'preact')) addUnique(frameworks, 'Preact');
  if (hasDependency(deps, 'alpinejs')) addUnique(frameworks, 'Alpine.js');
  if (hasDependency(deps, 'lit')) addUnique(frameworks, 'Lit');
  if (hasDependency(deps, '@stencil/core')) addUnique(frameworks, 'Stencil');
  if (hasDependency(deps, 'express')) addUnique(frameworks, 'Express');
  if (hasDependency(deps, '@nestjs/core', 'nestjs')) addUnique(frameworks, 'NestJS');
  if (hasDependency(deps, 'fastify')) addUnique(frameworks, 'Fastify');
  if (hasDependency(deps, 'hono')) addUnique(frameworks, 'Hono');
  if (hasDependency(deps, 'vite') || hasFile(detectedFiles, 'vite.config.ts') || hasFile(detectedFiles, 'vite.config.js')) addUnique(runtimes, 'Node.js');
  if (hasDependency(deps, 'bun') || hasFile(detectedFiles, 'bun.lock') || hasFile(detectedFiles, 'bun.lockb')) addUnique(runtimes, 'Bun');
  if (hasFile(detectedFiles, 'deno.json') || hasFile(detectedFiles, 'deno.jsonc')) addUnique(runtimes, 'Deno');
  if (hasFile(detectedFiles, 'package.json') || deps.size > 0) addUnique(runtimes, 'Node.js');

  // Python frameworks/runtime.
  const pythonText = textOf(files, ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py', 'setup.cfg']);
  if (/django/i.test(pythonText)) addUnique(frameworks, 'Django');
  if (/flask/i.test(pythonText)) addUnique(frameworks, 'Flask');
  if (/fastapi/i.test(pythonText)) addUnique(frameworks, 'FastAPI');
  if (hasFile(detectedFiles, 'requirements.txt') || hasFile(detectedFiles, 'pyproject.toml') || hasFile(detectedFiles, 'setup.py') || hasFile(detectedFiles, 'Pipfile') || hasFile(detectedFiles, '.python-version')) addUnique(runtimes, 'Python');

  // JVM frameworks/runtime.
  const jvmText = textOf(files, ['pom.xml', 'build.gradle', 'build.gradle.kts']);
  if (/spring-boot|org\.springframework/i.test(jvmText)) addUnique(frameworks, 'Spring Boot');
  if (/quarkus|io\.quarkus/i.test(jvmText)) addUnique(frameworks, 'Quarkus');
  if (/ktor|io\.ktor/i.test(jvmText)) addUnique(frameworks, 'Ktor');
  if (/micronaut|io\.micronaut/i.test(jvmText)) addUnique(frameworks, 'Micronaut');
  if (/playframework|play\.api/i.test(jvmText)) addUnique(frameworks, 'Play Framework');
  if (hasFile(detectedFiles, 'pom.xml') || hasFile(detectedFiles, 'build.gradle') || hasFile(detectedFiles, 'build.gradle.kts')) addUnique(runtimes, 'JVM');

  // Go / Rust frameworks and runtimes.
  const goText = textOf(files, ['go.mod', 'go.sum']);
  if (/github\.com\/gin-gonic\/gin|gin-gonic/i.test(goText)) addUnique(frameworks, 'Gin');
  if (/github\.com\/gofiber\/fiber|gofiber/i.test(goText)) addUnique(frameworks, 'Fiber');
  if (/github\.com\/labstack\/echo|labstack\/echo/i.test(goText)) addUnique(frameworks, 'Echo');
  if (/github\.com\/go-chi\/chi|go-chi\/chi/i.test(goText)) addUnique(frameworks, 'Chi');
  if (hasFile(detectedFiles, 'go.mod')) addUnique(runtimes, 'Go');

  const rustText = textOf(files, ['Cargo.toml', 'Cargo.lock']);
  if (/actix-web/i.test(rustText)) addUnique(frameworks, 'Actix');
  if (/axum/i.test(rustText)) addUnique(frameworks, 'Axum');
  if (/rocket/i.test(rustText)) addUnique(frameworks, 'Rocket');
  if (hasFile(detectedFiles, 'Cargo.toml')) addUnique(runtimes, 'Rust');

  // Ruby / Elixir / Dart / Swift / .NET.
  const rubyText = textOf(files, ['Gemfile', 'gems.rb']);
  if (/rails/i.test(rubyText)) addUnique(frameworks, 'Rails');
  if (/sinatra/i.test(rubyText)) addUnique(frameworks, 'Sinatra');
  if (hasFile(detectedFiles, 'Gemfile') || hasFile(detectedFiles, '.ruby-version')) addUnique(runtimes, 'Ruby');
  const elixirText = textOf(files, ['mix.exs']);
  if (/phoenix/i.test(elixirText)) addUnique(frameworks, 'Phoenix');
  if (hasFile(detectedFiles, 'mix.exs')) addUnique(runtimes, 'BEAM');
  if (hasFile(detectedFiles, 'pubspec.yaml')) { addUnique(frameworks, 'Flutter'); addUnique(runtimes, 'Dart'); }
  if (hasFile(detectedFiles, 'Package.swift')) addUnique(runtimes, 'Swift');
  if (hasFile(detectedFiles, 'packages.config') || files.some((f) => !f.isDirectory && f.path.toLowerCase().endsWith('.csproj'))) addUnique(runtimes, '.NET');

  // Keep legacy primary detections first.
  if (stack.framework !== 'Unknown') { const i = frameworks.indexOf(stack.framework); if (i >= 0) frameworks.splice(i, 1); frameworks.unshift(stack.framework); }
  if (stack.runtime !== 'Unknown') { const i = runtimes.indexOf(stack.runtime); if (i >= 0) runtimes.splice(i, 1); runtimes.unshift(stack.runtime); }

  return { frameworks, runtimes };
}
