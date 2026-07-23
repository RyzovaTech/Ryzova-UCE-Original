import type {
  ProjectFile,
  DetectedFile,
  TechnologyStack,
  ProjectSummary,
  Language,
  Framework,
  Runtime,
  PackageManager,
  BuildTool,
  ScanStats,
  MonorepoTool,
  CloudProvider,
  DetectionConfidence,
} from './types';

function hasFile(files: DetectedFile[] | ProjectFile[], name: string): boolean {
  return files.some((f) => f.path === name || f.path.endsWith('/' + name));
}

function hasPrefix(files: DetectedFile[] | ProjectFile[], prefix: string): boolean {
  return files.some((f) => {
    const base = f.path.split('/').pop() ?? f.path;
    return base.startsWith(prefix);
  });
}

function hasExtension(files: ProjectFile[], ext: string): boolean {
  const lower = ext.toLowerCase();
  return files.some((f) => !f.isDirectory && f.path.toLowerCase().endsWith(lower));
}

function hasAnyFile(files: DetectedFile[] | ProjectFile[], names: string[]): boolean {
  return names.some((n) => hasFile(files, n));
}

function readFileText(files: ProjectFile[], target: string): string | null {
  const matches = files.filter(
    (f) => !f.isDirectory && (f.path === target || f.path.endsWith('/' + target))
  );
  if (matches.length === 0) return null;
  matches.sort((a, b) => a.path.length - b.path.length);
  return matches[0].content ?? null;
}

function safeJson(content: string | null): Record<string, unknown> | null {
  if (!content) return null;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Tally total bytes of source code per language, restricted to source roots
// (excludes node_modules, vendor, tests, docs, build output, tooling dirs).
// Used to decide between competing language signals — e.g. a Linux kernel
// tarball that ships a few Node-based tooling files should be C, not TypeScript.
const SOURCE_ROOT_SKIP_PREFIXES = [
  'node_modules/', 'vendor/', 'third_party/', 'dist/', 'build/', 'out/',
  '.next/', '.nuxt/', '.svelte-kit/', 'target/', '__pycache__/', '.venv/',
  'venv/', 'docs/', 'doc/', 'Documentation/', 'test/', 'tests/', '__tests__/',
  'spec/', 'fixtures/', 'examples/', 'demo/', 'samples/', 'coverage/',
  'tools/', // tooling dirs often contain JS/TS that is NOT the project's language
];

function isLikelySourceRoot(path: string): boolean {
  const normalized = path.replace(/^\.\//, '');
  for (const skip of SOURCE_ROOT_SKIP_PREFIXES) {
    if (normalized.startsWith(skip)) return false;
  }
  return true;
}

const EXT_LANGUAGE: Record<string, Language> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.py': 'Python', '.rs': 'Rust', '.go': 'Go', '.java': 'Java',
  '.kt': 'Kotlin', '.kts': 'Kotlin', '.rb': 'Ruby',
  '.ex': 'Elixir', '.exs': 'Elixir', '.dart': 'Dart', '.swift': 'Swift',
  '.scala': 'Scala', '.sbt': 'Scala', '.cs': 'C#',
  '.c': 'C', '.h': 'C', '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++', '.hpp': 'C++', '.hh': 'C++',
  '.php': 'PHP',
};

function tallyLanguageBytes(projectFiles: ProjectFile[]): Map<Language, number> {
  const totals = new Map<Language, number>();
  for (const f of projectFiles) {
    if (f.isDirectory) continue;
    if (!isLikelySourceRoot(f.path)) continue;
    const lower = f.path.toLowerCase();
    const dot = lower.lastIndexOf('.');
    if (dot < 0) continue;
    const ext = lower.slice(dot);
    const lang = EXT_LANGUAGE[ext];
    if (!lang) continue;
    totals.set(lang, (totals.get(lang) ?? 0) + (f.size || 0));
  }
  return totals;
}

// Kernel / low-level C project signatures — directories and files that are
// strong signals of a C system-software project (Linux kernel, busybox, etc.).
function hasKernelSignatures(files: DetectedFile[] | ProjectFile[]): boolean {
  const paths = files.map((f) => f.path);
  const has = (p: string) => paths.some((x) => x === p || x.startsWith(p + '/') || x.endsWith('/' + p));
  return has('Kconfig') || has('Kbuild') || has('kernel') || has('drivers') ||
    has('arch') || has('include/linux') || has('mm') || has('fs/Kconfig');
}

export function detectLanguage(files: DetectedFile[], projectFiles: ProjectFile[]): Language {
  // --- Volume-weighted language detection ---
  // Tally source bytes per language first, then reconcile with manifest signals.
  // This prevents a large C codebase from being misdetected as TypeScript just
  // because it ships a few Node-based tooling files (tsconfig.json, package.json).
  const byteTotals = tallyLanguageBytes(projectFiles);
  const sortedByVolume = Array.from(byteTotals.entries()).sort((a, b) => b[1] - a[1]);
  const dominantByVolume = sortedByVolume[0]?.[0];
  const dominantBytes = sortedByVolume[0]?.[1] ?? 0;
  const secondBytes = sortedByVolume[1]?.[1] ?? 0;
  // Dominant only if it has meaningful volume and clearly outweighs the runner-up.
  const hasClearVolumeWinner = dominantBytes > 0 && dominantBytes >= secondBytes * 4 && dominantBytes > 50_000;

  // --- Kernel / system C detection (high confidence) ---
  // Strong C signatures override JS/TS manifests when the C volume is significant.
  const cBytes = byteTotals.get('C') ?? 0;
  const cppBytes = byteTotals.get('C++') ?? 0;
  if (hasKernelSignatures(files) && cBytes > 100_000 && cBytes > cppBytes) {
    return 'C';
  }

  // --- Manifest-based detection (high confidence) ---
  // Only trust a manifest if its language is consistent with the volume signal,
  // OR there is no clear volume winner (small / mixed projects).
  const manifestSaysTS = hasFile(files, 'tsconfig.json') || hasPrefix(files, 'tsconfig.');
  if (manifestSaysTS) {
    if (hasClearVolumeWinner && dominantByVolume !== 'TypeScript' && dominantByVolume !== 'JavaScript') {
      return dominantByVolume;
    }
    return 'TypeScript';
  }
  if (hasFile(files, 'package.json')) {
    const pkg = safeJson(readFileText(projectFiles, 'package.json'));
    const isTS = (pkg && typeof pkg.typescript === 'string') ||
      (pkg && typeof (pkg.devDependencies as Record<string, unknown> | undefined)?.typescript === 'string');
    const manifestLang: Language = isTS ? 'TypeScript' : 'JavaScript';
    if (hasClearVolumeWinner && dominantByVolume !== 'TypeScript' && dominantByVolume !== 'JavaScript') {
      return dominantByVolume;
    }
    return manifestLang;
  }
  if (hasAnyFile(files, [
    'requirements.txt', 'requirements-dev.txt', 'pyproject.toml', 'setup.py',
    'setup.cfg', 'Pipfile', 'Pipfile.lock', 'poetry.lock', 'uv.lock',
    'runtime.txt', '.python-version',
  ]) || hasExtension(projectFiles, '.py')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'Python') return dominantByVolume;
    return 'Python';
  }
  if (hasFile(files, 'Cargo.toml')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'Rust') return dominantByVolume;
    return 'Rust';
  }
  if (hasFile(files, 'go.mod')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'Go') return dominantByVolume;
    return 'Go';
  }
  if (hasFile(files, 'pom.xml') || hasFile(files, 'build.gradle') || hasFile(files, 'build.gradle.kts')) {
    const gradle = readFileText(projectFiles, 'build.gradle.kts');
    const manifestLang: Language = (gradle && /kotlin/i.test(gradle)) ? 'Kotlin' : 'Java';
    if (hasClearVolumeWinner && dominantByVolume !== 'Java' && dominantByVolume !== 'Kotlin') {
      return dominantByVolume;
    }
    return manifestLang;
  }
  if (hasFile(files, 'composer.json')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'PHP') return dominantByVolume;
    return 'PHP';
  }
  if (hasFile(files, 'Gemfile') || hasFile(files, '.ruby-version')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'Ruby') return dominantByVolume;
    return 'Ruby';
  }
  if (hasFile(files, 'mix.exs')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'Elixir') return dominantByVolume;
    return 'Elixir';
  }
  if (hasFile(files, 'pubspec.yaml')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'Dart') return dominantByVolume;
    return 'Dart';
  }
  if (hasFile(files, 'CMakeLists.txt')) {
    // CMake is used for both C and C++; pick whichever has more source volume.
    if (cBytes > cppBytes && cBytes > 0) return 'C';
    if (hasClearVolumeWinner && (dominantByVolume === 'C' || dominantByVolume === 'C++')) {
      return dominantByVolume;
    }
    return 'C++';
  }
  if (hasFile(files, 'Package.swift')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'Swift') return dominantByVolume;
    return 'Swift';
  }
  if (hasFile(files, 'build.sbt')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'Scala') return dominantByVolume;
    return 'Scala';
  }
  if (hasFile(files, 'packages.config') || projectFiles.some((f) => !f.isDirectory && f.path.toLowerCase().endsWith('.csproj'))) {
    if (hasClearVolumeWinner && dominantByVolume !== 'C#') return dominantByVolume;
    return 'C#';
  }

  // --- Extension-based fallback (catches source-only projects) ---
  // Prefer the volume winner if there is one; otherwise fall back to first-match.
  if (hasClearVolumeWinner) return dominantByVolume;
  if (hasExtension(projectFiles, '.ts') || hasExtension(projectFiles, '.tsx')) return 'TypeScript';
  if (hasExtension(projectFiles, '.js') || hasExtension(projectFiles, '.jsx') || hasExtension(projectFiles, '.mjs') || hasExtension(projectFiles, '.cjs')) return 'JavaScript';
  if (hasExtension(projectFiles, '.rs')) return 'Rust';
  if (hasExtension(projectFiles, '.go')) return 'Go';
  if (hasExtension(projectFiles, '.java')) return 'Java';
  if (hasExtension(projectFiles, '.kt') || hasExtension(projectFiles, '.kts')) return 'Kotlin';
  if (hasExtension(projectFiles, '.rb')) return 'Ruby';
  if (hasExtension(projectFiles, '.ex') || hasExtension(projectFiles, '.exs')) return 'Elixir';
  if (hasExtension(projectFiles, '.dart')) return 'Dart';
  if (hasExtension(projectFiles, '.swift')) return 'Swift';
  if (hasExtension(projectFiles, '.scala') || hasExtension(projectFiles, '.sbt')) return 'Scala';
  if (hasExtension(projectFiles, '.cs')) return 'C#';
  // Distinguish C from C++: .c/.h → C; .cpp/.cc/.cxx/.hpp/.hh → C++.
  if (hasExtension(projectFiles, '.cpp') || hasExtension(projectFiles, '.cc') || hasExtension(projectFiles, '.cxx') || hasExtension(projectFiles, '.hpp') || hasExtension(projectFiles, '.hh')) return 'C++';
  if (hasExtension(projectFiles, '.c') || hasExtension(projectFiles, '.h')) return 'C';
  if (hasExtension(projectFiles, '.php')) return 'PHP';

  return 'Unknown';
}

export function detectFramework(files: DetectedFile[], projectFiles: ProjectFile[]): Framework {
  const pkg = safeJson(readFileText(projectFiles, 'package.json')) ?? {};
  const deps = { ...(pkg.dependencies as Record<string, string> | undefined), ...(pkg.devDependencies as Record<string, string> | undefined) };

  if (hasPrefix(files, 'next.config.')) return 'Next.js';
  if (hasPrefix(files, 'nuxt.config.')) return 'Nuxt';
  if (hasPrefix(files, 'astro.config.')) return 'Astro';
  if (hasPrefix(files, 'remix.config.')) return 'Remix';
  if (hasPrefix(files, 'gatsby.config.')) return 'Gatsby';
  if (hasFile(files, 'angular.json')) return 'Angular';
  if (hasFile(files, 'svelte.config.js') || hasFile(files, 'svelte.config.mjs')) {
    if (deps['@sveltejs/kit']) return 'SvelteKit';
    return 'Svelte';
  }
  if (deps['next']) return 'Next.js';
  if (deps['nuxt']) return 'Nuxt';
  if (deps['astro']) return 'Astro';
  if (deps['@remix-run/react']) return 'Remix';
  if (deps['gatsby']) return 'Gatsby';
  if (deps['react']) return 'React';
  if (deps['vue']) return 'Vue';
  if (deps['@angular/core']) return 'Angular';
  if (deps['solid-js']) return 'Solid';
  if (deps['express']) return 'Express';
  if (deps['fastify']) return 'Fastify';
  if (deps['@nestjs/core']) return 'NestJS';
  if (deps['hono']) return 'Hono';

  if (hasFile(files, 'requirements.txt') || hasFile(files, 'pyproject.toml') || hasFile(files, 'setup.py') || hasFile(files, 'setup.cfg')) {
    const req = readFileText(projectFiles, 'requirements.txt')
      ?? readFileText(projectFiles, 'pyproject.toml')
      ?? readFileText(projectFiles, 'setup.py')
      ?? readFileText(projectFiles, 'setup.cfg')
      ?? '';
    if (/django/i.test(req)) return 'Django';
    if (/fastapi/i.test(req)) return 'FastAPI';
    if (/flask/i.test(req)) return 'Flask';
  }
  if (hasFile(files, 'pom.xml')) {
    const pom = readFileText(projectFiles, 'pom.xml') ?? '';
    if (/spring-boot/i.test(pom)) return 'Spring Boot';
    if (/quarkus/i.test(pom)) return 'Quarkus';
  }
  if (hasFile(files, 'Cargo.toml')) {
    const cargo = readFileText(projectFiles, 'Cargo.toml') ?? '';
    if (/actix/.test(cargo)) return 'Actix';
    if (/axum/.test(cargo)) return 'Axum';
    if (/rocket/.test(cargo)) return 'Rocket';
  }
  if (hasFile(files, 'Gemfile')) {
    const gemfile = readFileText(projectFiles, 'Gemfile') ?? '';
    if (/rails/i.test(gemfile)) return 'Rails';
    if (/sinatra/i.test(gemfile)) return 'Sinatra';
  }
  if (hasFile(files, 'mix.exs')) {
    const mix = readFileText(projectFiles, 'mix.exs') ?? '';
    if (/phoenix/i.test(mix)) return 'Phoenix';
  }
  if (hasFile(files, 'composer.json')) {
    const comp = safeJson(readFileText(projectFiles, 'composer.json')) ?? {};
    const req = { ...(comp.require as Record<string, string> | undefined) };
    if (req['laravel/framework']) return 'Laravel';
    if (req['symfony/framework-bundle']) return 'Symfony';
  }
  if (hasFile(files, 'pubspec.yaml')) {
    const pub = readFileText(projectFiles, 'pubspec.yaml') ?? '';
    if (/flutter/i.test(pub)) return 'Flutter';
  }
  if (hasFile(files, 'go.mod')) {
    const gomod = readFileText(projectFiles, 'go.mod') ?? '';
    if (/gin-gonic\/gin/.test(gomod)) return 'Gin';
  }
  return 'Unknown';
}

export function detectRuntime(files: DetectedFile[], projectFiles: ProjectFile[], stack: { language: Language; framework: Framework }): Runtime {
  if (stack.language === 'Python') return 'Python';
  if (stack.language === 'Rust') return 'Rust';
  if (stack.language === 'Go') return 'Go';
  if (stack.language === 'Ruby') return 'Ruby';
  if (stack.language === 'Elixir') return 'BEAM';
  if (stack.language === 'Dart') return 'Dart';
  if (stack.language === 'Swift') return 'Swift';
  if (stack.language === 'C#') return '.NET';
  if (stack.language === 'Java' || stack.language === 'Kotlin' || stack.language === 'Scala') return 'JVM';
  if (stack.language === 'TypeScript' || stack.language === 'JavaScript') {
    if (hasFile(files, 'bun.lockb') || hasFile(files, 'bun.lock') || hasFile(files, 'bunfig.toml')) return 'Bun';
    const pkg = safeJson(readFileText(projectFiles, 'package.json')) ?? {};
    if (pkg.bun || (pkg.scripts && typeof (pkg.scripts as Record<string, string>).bun === 'string')) return 'Bun';
    if (hasFile(files, 'deno.json') || hasFile(files, 'deno.jsonc') || hasFile(files, 'deno.lock')) return 'Deno';
    return 'Node.js';
  }
  return 'Unknown';
}

export function detectPackageManager(files: DetectedFile[], projectFiles: ProjectFile[], language: Language): PackageManager {
  if (hasFile(files, 'pnpm-lock.yaml')) return 'pnpm';
  if (hasFile(files, 'yarn.lock')) return 'yarn';
  if (hasFile(files, 'bun.lockb') || hasFile(files, 'bun.lock')) return 'bun';
  if (hasFile(files, 'package-lock.json')) return 'npm';
  if (hasFile(files, 'package.json')) return 'npm';
  if (hasFile(files, 'pyproject.toml')) {
    const content = readFileText(projectFiles, 'pyproject.toml') ?? '';
    if (/\[tool\.poetry\]/i.test(content)) return 'poetry';
    if (/\[tool\.pdm\]/i.test(content)) return 'pdm';
    if (/\[tool\.pipenv\]/i.test(content)) return 'pipenv';
    if (/\[tool\.uv\]/i.test(content)) return 'uv';
    if (/\[tool\.hatch\]/i.test(content)) return 'hatch';
    return 'pip';
  }
  if (hasFile(files, 'uv.lock')) return 'uv';
  if (hasFile(files, 'poetry.lock')) return 'poetry';
  if (hasFile(files, 'pdm.lock')) return 'pdm';
  if (hasFile(files, 'Pipfile')) return 'pipenv';
  if (hasFile(files, 'Pipfile.lock')) return 'pipenv';
  if (hasFile(files, 'requirements.txt') || hasFile(files, 'requirements-dev.txt')) return 'pip';
  if (hasFile(files, 'Cargo.toml')) return 'cargo';
  if (hasFile(files, 'go.mod')) return 'go-modules';
  if (hasFile(files, 'pom.xml')) return 'maven';
  if (hasFile(files, 'build.gradle') || hasFile(files, 'build.gradle.kts')) return 'gradle';
  if (hasFile(files, 'composer.json')) return 'composer';
  if (hasFile(files, 'Gemfile')) return 'bundler';
  if (hasFile(files, 'mix.exs')) return 'mix';
  if (hasFile(files, 'pubspec.yaml')) return 'pub';
  if (hasFile(files, 'Package.swift')) return 'swift-package';
  if (hasFile(files, 'build.sbt')) return 'sbt';
  if (hasFile(files, 'packages.config') || projectFiles.some((f) => !f.isDirectory && f.path.toLowerCase().endsWith('.csproj'))) return 'nuget';

  // Language-based fallback for source-only projects
  if (language === 'Python') return 'pip';
  if (language === 'Rust') return 'cargo';
  if (language === 'Go') return 'go-modules';
  if (language === 'Java' || language === 'Kotlin' || language === 'Scala') return 'maven';
  if (language === 'PHP') return 'composer';
  if (language === 'Ruby') return 'bundler';
  if (language === 'Elixir') return 'mix';
  if (language === 'Dart') return 'pub';
  if (language === 'Swift') return 'swift-package';
  if (language === 'C#') return 'nuget';
  if (language === 'TypeScript' || language === 'JavaScript') return 'npm';

  return 'Unknown';
}

export function detectBuildTool(files: DetectedFile[], stack: { framework: Framework; packageManager: PackageManager; language: Language }): BuildTool {
  if (hasPrefix(files, 'vite.config.')) return 'Vite';
  if (hasPrefix(files, 'next.config.')) return 'Next.js';
  if (hasPrefix(files, 'nuxt.config.')) return 'Nuxt';
  if (hasPrefix(files, 'astro.config.')) return 'Astro';
  if (hasPrefix(files, 'remix.config.')) return 'Remix';
  if (hasPrefix(files, 'gatsby.config.')) return 'Gatsby';
  if (hasFile(files, 'angular.json')) return 'Angular CLI';
  if (hasFile(files, 'Cargo.toml')) return 'Cargo';
  if (hasFile(files, 'pom.xml')) return 'Maven';
  if (hasFile(files, 'build.gradle') || hasFile(files, 'build.gradle.kts')) return 'Gradle';
  if (hasFile(files, 'CMakeLists.txt')) return 'CMake';
  if (hasFile(files, 'Makefile')) return 'Make';
  if (hasFile(files, 'Package.swift')) return 'Swift Package Manager';
  if (hasFile(files, 'mix.exs')) return 'Mix';
  if (hasFile(files, 'pubspec.yaml')) return 'Pub';
  if (hasFile(files, 'turbo.json')) return 'Turbo';
  if (hasPrefix(files, 'webpack.config.')) return 'Webpack';
  if (hasPrefix(files, 'rollup.config.')) return 'Rollup';
  if (hasPrefix(files, 'esbuild.config.')) return 'esbuild';
  if (hasFile(files, 'pyproject.toml') || hasFile(files, 'requirements.txt') || hasFile(files, 'requirements-dev.txt')) {
    if (stack.packageManager === 'poetry') return 'poetry';
    if (stack.packageManager === 'hatch') return 'hatch';
    return 'pip';
  }

  // Language-based fallback for source-only projects
  if (stack.language === 'Python') return 'pip';
  if (stack.language === 'Rust') return 'Cargo';
  if (stack.language === 'Go') return 'Unknown';
  if (stack.language === 'C++') return 'CMake';
  if (stack.language === 'Swift') return 'Swift Package Manager';
  if (stack.language === 'Elixir') return 'Mix';
  if (stack.language === 'Dart') return 'Pub';

  if (stack.framework === 'React') return 'Create React App';
  return 'Unknown';
}

const FRONTEND_FRAMEWORKS: Framework[] = [
  'Next.js', 'Nuxt', 'Astro', 'Remix', 'Gatsby', 'React', 'Vue', 'Angular',
  'Svelte', 'SvelteKit', 'Solid', 'Flutter',
];

const BACKEND_FRAMEWORKS: Framework[] = [
  'Express', 'NestJS', 'Fastify', 'Hono', 'Django', 'Flask', 'FastAPI',
  'Spring Boot', 'Quarkus', 'Actix', 'Axum', 'Rocket', 'Rails', 'Sinatra',
  'Phoenix', 'Laravel', 'Symfony', 'Gin',
];

export function detectMonorepo(detectedFiles: DetectedFile[], projectFiles: ProjectFile[]): MonorepoTool | 'None' {
  if (detectedFiles.some((f) => f.path === 'nx.json' || f.path.endsWith('/nx.json'))) return 'Nx';
  if (detectedFiles.some((f) => f.path === 'turbo.json' || f.path.endsWith('/turbo.json'))) return 'Turborepo';
  if (detectedFiles.some((f) => f.path === 'lerna.json' || f.path.endsWith('/lerna.json'))) return 'Lerna';
  if (detectedFiles.some((f) => f.path === 'rush.json' || f.path.endsWith('/rush.json'))) return 'Rush';
  if (detectedFiles.some((f) => f.path === 'pnpm-workspace.yaml' || f.path.endsWith('/pnpm-workspace.yaml'))) return 'pnpm Workspaces';
  const pkg = projectFiles.find((f) => f.path === 'package.json' || f.path.endsWith('/package.json'));
  if (pkg?.content) {
    try {
      const p = JSON.parse(pkg.content);
      if (p.workspaces) return 'Yarn Workspaces';
    } catch {
      // ignore
    }
  }
  return 'None';
}

export function detectCloudProvider(detectedFiles: DetectedFile[]): CloudProvider | 'None' {
  if (detectedFiles.some((f) => f.path === 'vercel.json' || f.path.endsWith('/vercel.json'))) return 'Vercel';
  if (detectedFiles.some((f) => f.path === 'netlify.toml' || f.path.endsWith('/netlify.toml'))) return 'Netlify';
  if (detectedFiles.some((f) => f.path === 'railway.json' || f.path.endsWith('/railway.json') || f.path === 'railway.toml' || f.path.endsWith('/railway.toml'))) return 'Railway';
  if (detectedFiles.some((f) => f.path === 'fly.toml' || f.path.endsWith('/fly.toml'))) return 'Fly.io';
  if (detectedFiles.some((f) => f.path === 'render.yaml' || f.path.endsWith('/render.yaml'))) return 'Render';
  if (detectedFiles.some((f) => f.path === 'wrangler.toml' || f.path.endsWith('/wrangler.toml') || f.path === 'wrangler.json' || f.path.endsWith('/wrangler.json'))) return 'Cloudflare';
  return 'None';
}

function computeConfidence(
  detectedFiles: DetectedFile[],
  projectFiles: ProjectFile[],
  language: Language,
  framework: Framework,
  runtime: Runtime,
  packageManager: PackageManager,
  buildTool: BuildTool
): DetectionConfidence {
  const hasManifest = (names: string[]) => detectedFiles.some((f) => names.some((n) => f.path === n || f.path.endsWith('/' + n)));
  const hasExtension = (ext: string) => projectFiles.some((f) => !f.isDirectory && f.path.toLowerCase().endsWith(ext));

  // Volume-weighted language confidence. A manifest is strong evidence, but
  // if the actual source bytes are dominated by a different language, the
  // manifest is likely for tooling only (e.g. Linux kernel ships tsconfig.json
  // for its Node-based tooling) — drop confidence sharply in that case.
  const byteTotals = tallyLanguageBytes(projectFiles);
  const sortedBytes = Array.from(byteTotals.entries()).sort((a, b) => b[1] - a[1]);
  const topLangByBytes = sortedBytes[0]?.[0];
  const topBytes = sortedBytes[0]?.[1] ?? 0;
  const secondBytes = sortedBytes[1]?.[1] ?? 0;
  const volumeDominant = topBytes > 0 && topBytes >= secondBytes * 4 && topBytes > 50_000;
  const volumeMismatch = volumeDominant && topLangByBytes !== language;

  let languageConfidence = 50;
  if (language === 'TypeScript') {
    if (hasManifest(['tsconfig.json'])) languageConfidence = 100;
    else if (hasManifest(['package.json'])) languageConfidence = 95;
    else if (hasExtension('.ts') || hasExtension('.tsx')) languageConfidence = 80;
  } else if (language === 'JavaScript') {
    if (hasManifest(['package.json'])) languageConfidence = 100;
    else if (hasExtension('.js') || hasExtension('.jsx')) languageConfidence = 80;
  } else if (language === 'Python') {
    if (hasManifest(['pyproject.toml', 'setup.py', 'requirements.txt'])) languageConfidence = 100;
    else if (hasExtension('.py')) languageConfidence = 80;
  } else if (language === 'Rust') {
    if (hasManifest(['Cargo.toml'])) languageConfidence = 100;
    else if (hasExtension('.rs')) languageConfidence = 80;
  } else if (language === 'Go') {
    if (hasManifest(['go.mod'])) languageConfidence = 100;
    else if (hasExtension('.go')) languageConfidence = 80;
  } else if (language === 'C') {
    // C is detected when kernel signatures or .c/.h volume dominate.
    if (hasKernelSignatures(detectedFiles)) languageConfidence = 98;
    else if (hasExtension('.c') || hasExtension('.h')) languageConfidence = 85;
  } else if (language === 'C++') {
    if (hasManifest(['CMakeLists.txt'])) languageConfidence = 95;
    else if (hasExtension('.cpp') || hasExtension('.cc') || hasExtension('.hpp')) languageConfidence = 85;
  } else if (language !== 'Unknown') {
    languageConfidence = hasManifest(['Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'composer.json', 'Gemfile', 'mix.exs', 'pubspec.yaml', 'CMakeLists.txt', 'Package.swift', 'build.sbt']) ? 100 : 80;
  }
  // If the source volume is dominated by a different language, the manifest
  // is likely tooling-only — cap confidence low so the UI can flag uncertainty.
  if (volumeMismatch) {
    languageConfidence = Math.min(languageConfidence, 45);
  }

  let frameworkConfidence = 50;
  const pkg = projectFiles.find((f) => f.path === 'package.json' || f.path.endsWith('/package.json'));
  let pkgDeps: Record<string, string> = {};
  if (pkg?.content) {
    try {
      const p = JSON.parse(pkg.content);
      pkgDeps = { ...(p.dependencies ?? {}), ...(p.devDependencies ?? {}) } as Record<string, string>;
    } catch {
      // ignore
    }
  }
  if (framework !== 'Unknown') {
    const configBased = detectedFiles.some((f) =>
      /next\.config|nuxt\.config|astro\.config|remix\.config|gatsby\.config|angular\.json|svelte\.config/.test(f.path)
    );
    const depBased = !!pkgDeps[framework] || !!pkgDeps['@angular/core'] || !!pkgDeps['@sveltejs/kit'] || !!pkgDeps['react'] || !!pkgDeps['vue'] || !!pkgDeps['solid-js'] || !!pkgDeps['express'] || !!pkgDeps['fastify'] || !!pkgDeps['@nestjs/core'] || !!pkgDeps['hono'];
    if (configBased) frameworkConfidence = 99;
    else if (depBased) frameworkConfidence = 95;
    else frameworkConfidence = 75;
  }

  let runtimeConfidence = 50;
  if (runtime === 'Node.js') runtimeConfidence = hasManifest(['package.json']) ? 98 : 75;
  else if (runtime === 'Bun') runtimeConfidence = hasManifest(['bun.lockb', 'bun.lock', 'bunfig.toml']) ? 99 : 80;
  else if (runtime === 'Deno') runtimeConfidence = hasManifest(['deno.json', 'deno.jsonc', 'deno.lock']) ? 99 : 80;
  else if (runtime === 'Python') runtimeConfidence = hasManifest(['pyproject.toml', 'requirements.txt', 'runtime.txt']) ? 98 : 75;
  else if (runtime === 'Rust') runtimeConfidence = hasManifest(['Cargo.toml']) ? 99 : 75;
  else if (runtime === 'Go') runtimeConfidence = hasManifest(['go.mod']) ? 99 : 75;
  else if (runtime !== 'Unknown') runtimeConfidence = 90;

  let pmConfidence = 50;
  if (packageManager === 'npm') pmConfidence = hasManifest(['package-lock.json']) ? 100 : (hasManifest(['package.json']) ? 90 : 60);
  else if (packageManager === 'pnpm') pmConfidence = hasManifest(['pnpm-lock.yaml']) ? 100 : 80;
  else if (packageManager === 'yarn') pmConfidence = hasManifest(['yarn.lock']) ? 100 : 80;
  else if (packageManager === 'bun') pmConfidence = hasManifest(['bun.lockb', 'bun.lock']) ? 100 : 80;
  else if (packageManager === 'cargo') pmConfidence = hasManifest(['Cargo.toml']) ? 100 : 70;
  else if (packageManager === 'go-modules') pmConfidence = hasManifest(['go.mod']) ? 100 : 70;
  else if (packageManager !== 'Unknown') pmConfidence = 90;

  let buildConfidence = 50;
  if (buildTool !== 'Unknown') {
    const configBased = detectedFiles.some((f) =>
      /vite\.config|next\.config|nuxt\.config|astro\.config|remix\.config|gatsby\.config|angular\.json|webpack\.config|rollup\.config|esbuild\.config|Cargo\.toml|pom\.xml|build\.gradle|CMakeLists\.txt|Makefile|turbo\.json/.test(f.path)
    );
    buildConfidence = configBased ? 98 : 75;
  }

  return {
    language: languageConfidence,
    framework: frameworkConfidence,
    runtime: runtimeConfidence,
    packageManager: pmConfidence,
    buildTool: buildConfidence,
  };
}

export function detectStack(projectFiles: ProjectFile[], detectedFiles: DetectedFile[]): TechnologyStack {
  const language = detectLanguage(detectedFiles, projectFiles);
  const framework = detectFramework(detectedFiles, projectFiles);
  const runtime = detectRuntime(detectedFiles, projectFiles, { language, framework });
  const packageManager = detectPackageManager(detectedFiles, projectFiles, language);
  const buildTool = detectBuildTool(detectedFiles, { framework, packageManager, language });

  const frontend: Framework | 'None' | 'Unknown' =
    FRONTEND_FRAMEWORKS.includes(framework) ? framework : 'Unknown';
  const backend: Framework | 'None' | 'Unknown' =
    BACKEND_FRAMEWORKS.includes(framework) ? framework : 'None';

  const database: 'Detected' | 'Unknown' =
    projectFiles.some((f) =>
      /prisma|schema\.prisma|drizzle|sequelize|typeorm|mongoose|knex|mikro-orm|alembic|sqlx|golang-migrate|dbmate|gqlgen|hasura|supabase|firebase|firestore|redis|memcached|elasticsearch/i.test(
        f.path
      )
    )
      ? 'Detected'
      : 'Unknown';

  const monorepo = detectMonorepo(detectedFiles, projectFiles);
  const cloudProvider = detectCloudProvider(detectedFiles);
  const confidence = computeConfidence(detectedFiles, projectFiles, language, framework, runtime, packageManager, buildTool);

  return {
    language,
    framework,
    runtime,
    packageManager,
    buildTool,
    frontend,
    backend,
    database,
    configFiles: detectedFiles.map((f) => f.path),
    monorepo,
    cloudProvider,
    confidence,
  };
}

export function buildSummary(
  name: string,
  projectFiles: ProjectFile[],
  detectedFiles: DetectedFile[],
  stack: TechnologyStack,
  scanStats: ScanStats
): ProjectSummary {
  const foldersScanned = new Set(
    projectFiles.filter((f) => f.isDirectory).map((f) => f.path)
  ).size;
  return {
    name,
    framework: stack.framework,
    language: stack.language,
    runtime: stack.runtime,
    packageManager: stack.packageManager,
    detectedConfigFiles: detectedFiles.map((f) => f.path),
    filesScanned: projectFiles.filter((f) => !f.isDirectory).length,
    foldersScanned,
    scanStats,
  };
}
