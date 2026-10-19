import { pythonMetadataValue } from './python-evidence';
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
import { ADDITIONAL_LANGUAGE_EXTENSIONS } from './language-knowledge';
import { classifyProjectFileScope, isProjectEvidenceFile } from './project-scope';

function hasFile(files: DetectedFile[] | ProjectFile[], name: string): boolean {
  return files.some((f) => f.path === name || f.path.endsWith('/' + name));
}

function hasRootFile(files: DetectedFile[] | ProjectFile[], name: string): boolean {
  return files.some((file) => file.path === name);
}

const AUXILIARY_PROJECT_ROOT_RE = /^(?:tools?|docs?|documentation|tests?|testing|fixtures?|examples?|samples?|benchmarks?|vendor|third_party|node_modules)(?:\/|$)/i;

function isPrimaryProjectPath(path: string): boolean {
  return !AUXILIARY_PROJECT_ROOT_RE.test(path.replace(/^\.\//, ''));
}

function primaryDetectedFiles(files: DetectedFile[]): DetectedFile[] {
  return files.filter((file) => {
    const scope = classifyProjectFileScope(file.path);
    return isPrimaryProjectPath(file.path) && (scope === 'production' || scope === 'configuration');
  });
}

function hasPrimaryFile(files: DetectedFile[] | ProjectFile[], name: string): boolean {
  return files.some((file) => isPrimaryProjectPath(file.path) && (file.path === name || file.path.endsWith('/' + name)));
}

function readPrimaryFileText(files: ProjectFile[], target: string): string | null {
  const matches = files.filter((file) => !file.isDirectory && isProjectEvidenceFile(file) && isPrimaryProjectPath(file.path) && (file.path === target || file.path.endsWith('/' + target)));
  if (!matches.length) return null;
  matches.sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.length - b.path.length);
  return matches[0].content ?? null;
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

function safeJson(content: string | null): Record<string, unknown> | null {
  if (!content) return null;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const SOURCE_ROOT_SKIP_PREFIXES = [
  'node_modules/', 'vendor/', 'third_party/', 'dist/', 'build/', 'out/',
  '.next/', '.nuxt/', '.svelte-kit/', 'target/', '__pycache__/', '.venv/',
  'venv/', 'docs/', 'doc/', 'Documentation/', 'test/', 'tests/', '__tests__/',
  'spec/', 'fixtures/', 'examples/', 'demo/', 'samples/', 'coverage/',
  'tools/',
];

function isLikelySourceRoot(path: string): boolean {
  const normalized = path.replace(/^\.\//, '');
  for (const skip of SOURCE_ROOT_SKIP_PREFIXES) {
    if (normalized.startsWith(skip) || normalized.includes(`/${skip}`)) return false;
  }
  return true;
}

const EXT_LANGUAGE: Record<string, Language> = {
  ...ADDITIONAL_LANGUAGE_EXTENSIONS,
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.py': 'Python', '.rs': 'Rust', '.go': 'Go', '.java': 'Java',
  '.kt': 'Kotlin', '.kts': 'Kotlin', '.rb': 'Ruby',
  '.ex': 'Elixir', '.exs': 'Elixir', '.dart': 'Dart', '.swift': 'Swift',
  '.scala': 'Scala', '.sbt': 'Scala', '.cs': 'C#',
  '.c': 'C', '.h': 'C', '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++', '.hpp': 'C++', '.hh': 'C++',
  '.php': 'PHP',
  '.zig': 'Zig',
  '.ml': 'OCaml', '.mli': 'OCaml',
  '.hs': 'Haskell', '.lhs': 'Haskell',
  '.lua': 'Lua',
  '.jl': 'Julia',
  '.r': 'R', '.R': 'R',
  '.cr': 'Crystal',
  '.nim': 'Nim',
  '.sol': 'Solidity',
  '.v': 'V',
  '.pl': 'Perl', '.pm': 'Perl',
  '.erl': 'Erlang', '.hrl': 'Erlang',
};

function tallyLanguageBytes(projectFiles: ProjectFile[]): Map<Language, number> {
  const totals = new Map<Language, number>();
  for (const f of projectFiles) {
    if (!isProjectEvidenceFile(f)) continue;
    if (!isLikelySourceRoot(f.path)) continue;
    const lower = f.path.toLowerCase();
    const dot = lower.lastIndexOf('.');
    if (dot < 0) continue;
    const ext = lower.slice(dot);
    const lang = EXT_LANGUAGE[ext];
    if (!lang || ['JSON', 'YAML', 'TOML', 'XML', 'CSS', 'SCSS', 'Sass', 'Less', 'Stylus'].includes(lang)) continue;
    totals.set(lang, (totals.get(lang) ?? 0) + (f.size || 0));
  }
  return totals;
}

function hasKernelSignatures(files: DetectedFile[] | ProjectFile[]): boolean {
  const paths = files.map((f) => f.path.replace(/^\.\//, ''));
  const exact = (p: string) => paths.some((x) => x === p);
  const under = (p: string) => paths.some((x) => x === p || x.startsWith(p + '/'));
  const rootBuild = exact('Kconfig') && (exact('Kbuild') || exact('Makefile'));
  const structureSignals = ['arch', 'drivers', 'kernel', 'include/linux', 'mm', 'fs'].filter((path) => under(path)).length;
  return rootBuild && structureSignals >= 3;
}

export function detectLanguage(files: DetectedFile[], projectFiles: ProjectFile[]): Language {
  const scoped = primaryDetectedFiles(files);
  const sources = projectFiles.filter((file) => isProjectEvidenceFile(file) && isLikelySourceRoot(file.path));
  const byteTotals = tallyLanguageBytes(projectFiles);
  const sortedByVolume = Array.from(byteTotals.entries()).sort((a, b) => b[1] - a[1]);
  const dominantByVolume = sortedByVolume[0]?.[0];
  const dominantBytes = sortedByVolume[0]?.[1] ?? 0;
  const secondBytes = sortedByVolume[1]?.[1] ?? 0;
  const hasClearVolumeWinner = dominantBytes > 0 && dominantBytes >= secondBytes * 4 && dominantBytes > 50_000;

  const cBytes = byteTotals.get('C') ?? 0;
  const cppBytes = byteTotals.get('C++') ?? 0;
  if (hasKernelSignatures(projectFiles) && cBytes > 0 && cBytes >= cppBytes) {
    return 'C';
  }
  // Hardhat's TypeScript config is tooling, not proof that the contracts use TypeScript.
  if (hasExtension(sources, '.sol') &&
      scoped.some((file) => /(?:^|\/)hardhat\.config\.(?:[cm]?[jt]s)$/i.test(file.path))) {
    return 'Solidity';
  }

  const manifestSaysTS = hasFile(scoped, 'tsconfig.json') || hasPrefix(scoped, 'tsconfig.');
  if (manifestSaysTS) {
    if (hasClearVolumeWinner && dominantByVolume !== 'TypeScript' && dominantByVolume !== 'JavaScript') {
      return dominantByVolume;
    }
    return 'TypeScript';
  }
  if (hasFile(scoped, 'package.json')) {
    const pkg = safeJson(readPrimaryFileText(projectFiles, 'package.json'));
    const isTS = (pkg && typeof pkg.typescript === 'string') ||
      (pkg && typeof (pkg.devDependencies as Record<string, unknown> | undefined)?.typescript === 'string');
    const manifestLang: Language = isTS ? 'TypeScript' : 'JavaScript';
    if (hasClearVolumeWinner && dominantByVolume !== 'TypeScript' && dominantByVolume !== 'JavaScript') {
      return dominantByVolume;
    }
    return manifestLang;
  }
  if (hasAnyFile(scoped, [
    'requirements.txt', 'requirements-dev.txt', 'pyproject.toml', 'setup.py',
    'setup.cfg', 'Pipfile', 'Pipfile.lock', 'poetry.lock', 'uv.lock',
    'runtime.txt', '.python-version',
  ]) || hasExtension(sources, '.py')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'Python') return dominantByVolume;
    return 'Python';
  }
  if (hasFile(scoped, 'Cargo.toml')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'Rust') return dominantByVolume;
    return 'Rust';
  }
  if (hasFile(scoped, 'go.mod')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'Go') return dominantByVolume;
    return 'Go';
  }
  if (hasFile(scoped, 'pom.xml') || hasFile(scoped, 'build.gradle') || hasFile(scoped, 'build.gradle.kts')) {
    const gradle = readPrimaryFileText(projectFiles, 'build.gradle.kts');
    const manifestLang: Language = (gradle && /kotlin/i.test(gradle)) ? 'Kotlin' : 'Java';
    if (hasClearVolumeWinner && dominantByVolume !== 'Java' && dominantByVolume !== 'Kotlin') {
      return dominantByVolume;
    }
    return manifestLang;
  }
  if (hasFile(scoped, 'composer.json')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'PHP') return dominantByVolume;
    return 'PHP';
  }
  if (hasFile(scoped, 'Gemfile') || hasFile(scoped, '.ruby-version')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'Ruby') return dominantByVolume;
    return 'Ruby';
  }
  if (hasFile(scoped, 'mix.exs')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'Elixir') return dominantByVolume;
    return 'Elixir';
  }
  if (hasFile(scoped, 'pubspec.yaml')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'Dart') return dominantByVolume;
    return 'Dart';
  }
  if (hasFile(scoped, 'CMakeLists.txt')) {
    if (cBytes > cppBytes && cBytes > 0) return 'C';
    if (hasClearVolumeWinner && (dominantByVolume === 'C' || dominantByVolume === 'C++')) {
      return dominantByVolume;
    }
    return 'C++';
  }
  if (hasFile(scoped, 'Package.swift')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'Swift') return dominantByVolume;
    return 'Swift';
  }
  if (hasFile(scoped, 'build.sbt')) {
    if (hasClearVolumeWinner && dominantByVolume !== 'Scala') return dominantByVolume;
    return 'Scala';
  }
  if (hasFile(scoped, 'packages.config') || sources.some((f) => f.path.toLowerCase().endsWith('.csproj'))) {
    if (hasClearVolumeWinner && dominantByVolume !== 'C#') return dominantByVolume;
    return 'C#';
  }
  if (hasFile(scoped, 'build.zig') || hasFile(scoped, 'build.zig.zon')) return 'Zig';
  if (hasFile(scoped, 'dune-project') || hasFile(scoped, 'dune-workspace') || hasFile(scoped, 'opam')) return 'OCaml';
  if (hasFile(scoped, 'stack.yaml') || hasFile(scoped, 'cabal.project') || hasFile(scoped, 'package.yaml')) return 'Haskell';
  if (hasFile(scoped, 'Project.toml') && hasExtension(sources, '.jl')) return 'Julia';
  if (hasFile(scoped, 'DESCRIPTION') && (hasExtension(sources, '.r') || hasExtension(sources, '.R'))) return 'R';
  if (hasFile(scoped, 'shard.yml')) return 'Crystal';
  if (hasFile(scoped, 'v.mod')) return 'V';
  if (hasFile(scoped, 'cpanfile') || hasFile(scoped, 'Makefile.PL') || hasFile(scoped, 'Build.PL')) return 'Perl';
  if (hasFile(scoped, 'rebar.config') || hasFile(scoped, 'rebar3')) return 'Erlang';

  if (hasClearVolumeWinner) return dominantByVolume;
  if (hasExtension(sources, '.ts') || hasExtension(sources, '.tsx')) return 'TypeScript';
  if (hasExtension(sources, '.js') || hasExtension(sources, '.jsx') || hasExtension(sources, '.mjs') || hasExtension(sources, '.cjs')) return 'JavaScript';
  if (hasExtension(sources, '.rs')) return 'Rust';
  if (hasExtension(sources, '.go')) return 'Go';
  if (hasExtension(sources, '.java')) return 'Java';
  if (hasExtension(sources, '.kt') || hasExtension(sources, '.kts')) return 'Kotlin';
  if (hasExtension(sources, '.rb')) return 'Ruby';
  if (hasExtension(sources, '.ex') || hasExtension(sources, '.exs')) return 'Elixir';
  if (hasExtension(sources, '.dart')) return 'Dart';
  if (hasExtension(sources, '.swift')) return 'Swift';
  if (hasExtension(sources, '.scala') || hasExtension(sources, '.sbt')) return 'Scala';
  if (hasExtension(sources, '.cs')) return 'C#';
  if (hasExtension(sources, '.cpp') || hasExtension(sources, '.cc') || hasExtension(sources, '.cxx') || hasExtension(sources, '.hpp') || hasExtension(sources, '.hh')) return 'C++';
  if (hasExtension(sources, '.c') || hasExtension(sources, '.h')) return 'C';
  if (hasExtension(sources, '.php')) return 'PHP';
  if (hasExtension(sources, '.zig')) return 'Zig';
  if (hasExtension(sources, '.ml') || hasExtension(sources, '.mli')) return 'OCaml';
  if (hasExtension(sources, '.hs') || hasExtension(sources, '.lhs')) return 'Haskell';
  if (hasExtension(sources, '.lua')) return 'Lua';
  if (hasExtension(sources, '.jl')) return 'Julia';
  if (hasExtension(sources, '.r')) return 'R';
  if (hasExtension(sources, '.cr')) return 'Crystal';
  if (hasExtension(sources, '.nim')) return 'Nim';
  if (hasExtension(sources, '.sol')) return 'Solidity';
  if (hasExtension(sources, '.v')) return 'V';
  if (hasExtension(sources, '.pl') || hasExtension(sources, '.pm')) return 'Perl';
  if (hasExtension(sources, '.erl') || hasExtension(sources, '.hrl')) return 'Erlang';

  const additional = Object.entries(ADDITIONAL_LANGUAGE_EXTENSIONS).find(([extension]) =>
    projectFiles.some((file) => isProjectEvidenceFile(file) && file.path.toLowerCase().endsWith(extension)));
  if (additional) return additional[1];

  return 'Unknown';
}

export function detectFramework(files: DetectedFile[], projectFiles: ProjectFile[]): Framework {
  if (hasKernelSignatures(projectFiles)) return 'Unknown';
  const scoped = primaryDetectedFiles(files);
  const pkg = safeJson(readPrimaryFileText(projectFiles, 'package.json')) ?? {};
  const deps = { ...(pkg.dependencies as Record<string, string> | undefined), ...(pkg.devDependencies as Record<string, string> | undefined) };

  if (hasPrefix(scoped, 'next.config.')) return 'Next.js';
  if (hasPrefix(scoped, 'nuxt.config.')) return 'Nuxt';
  if (hasPrefix(scoped, 'astro.config.')) return 'Astro';
  if (hasPrefix(scoped, 'remix.config.')) return 'Remix';
  if (hasPrefix(scoped, 'gatsby.config.')) return 'Gatsby';
  if (hasFile(scoped, 'angular.json')) return 'Angular';
  if (hasFile(scoped, 'svelte.config.js') || hasFile(scoped, 'svelte.config.mjs')) {
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
  if (deps['@builder.io/qwik']) return 'Qwik';
  if (deps['preact']) return 'Preact';
  if (deps['alpinejs']) return 'Alpine.js';
  if (deps['lit']) return 'Lit';
  if (deps['@stencil/core']) return 'Stencil';

  if (hasFile(scoped, 'requirements.txt') || hasFile(scoped, 'pyproject.toml') || hasFile(scoped, 'setup.py') || hasFile(scoped, 'setup.cfg')) {
    const req = ['requirements.txt', 'pyproject.toml', 'setup.py', 'setup.cfg']
      .map((name) => readPrimaryFileText(projectFiles, name) ?? '')
      .join('\n');
    if (/django/i.test(req)) return 'Django';
    if (/fastapi/i.test(req)) return 'FastAPI';
    if (/flask/i.test(req)) return 'Flask';
  }
  if (hasFile(scoped, 'pom.xml')) {
    const pom = readPrimaryFileText(projectFiles, 'pom.xml') ?? '';
    if (/spring-boot/i.test(pom)) return 'Spring Boot';
    if (/quarkus/i.test(pom)) return 'Quarkus';
    if (/playframework|com\.typesafe\.play/i.test(pom)) return 'Play Framework';
  }
  if (hasFile(scoped, 'Cargo.toml')) {
    const cargo = readPrimaryFileText(projectFiles, 'Cargo.toml') ?? '';
    if (/actix/.test(cargo)) return 'Actix';
    if (/axum/.test(cargo)) return 'Axum';
    if (/rocket/.test(cargo)) return 'Rocket';
  }
  if (hasFile(scoped, 'Gemfile')) {
    const gemfile = readPrimaryFileText(projectFiles, 'Gemfile') ?? '';
    if (/rails/i.test(gemfile)) return 'Rails';
    if (/sinatra/i.test(gemfile)) return 'Sinatra';
  }
  if (hasFile(scoped, 'mix.exs')) {
    const mix = readPrimaryFileText(projectFiles, 'mix.exs') ?? '';
    if (/phoenix/i.test(mix)) return 'Phoenix';
  }
  if (hasFile(scoped, 'composer.json')) {
    const comp = safeJson(readPrimaryFileText(projectFiles, 'composer.json')) ?? {};
    const req = { ...(comp.require as Record<string, string> | undefined) };
    if (req['laravel/framework']) return 'Laravel';
    if (req['symfony/framework-bundle']) return 'Symfony';
  }
  if (hasFile(scoped, 'pubspec.yaml')) {
    const pub = readPrimaryFileText(projectFiles, 'pubspec.yaml') ?? '';
    if (/flutter/i.test(pub)) return 'Flutter';
  }
  if (hasFile(scoped, 'go.mod')) {
    const gomod = readPrimaryFileText(projectFiles, 'go.mod') ?? '';
    if (/gin-gonic\/gin/.test(gomod)) return 'Gin';
    if (/gofiber\/fiber/.test(gomod)) return 'Fiber';
    if (/labstack\/echo/.test(gomod)) return 'Echo';
    if (/go-chi\/chi/.test(gomod)) return 'Chi';
    if (/revel\/revel/.test(gomod)) return 'Revel';
  }
  if (hasFile(scoped, 'build.gradle') || hasFile(scoped, 'build.gradle.kts')) {
    const gradle = readPrimaryFileText(projectFiles, 'build.gradle') ?? readPrimaryFileText(projectFiles, 'build.gradle.kts') ?? '';
    if (/ktor/i.test(gradle)) return 'Ktor';
    if (/micronaut/i.test(gradle)) return 'Micronaut';
  }
  if (hasFile(scoped, 'Package.swift')) {
    const swift = readPrimaryFileText(projectFiles, 'Package.swift') ?? '';
    if (/vapor/i.test(swift)) return 'Vapor';
  }
  return 'Unknown';
}

export function detectRuntime(files: DetectedFile[], projectFiles: ProjectFile[], stack: { language: Language; framework: Framework }): Runtime {
  const scoped = primaryDetectedFiles(files);
  if (stack.language === 'Python') return 'Python';
  if (stack.language === 'Rust') return 'Rust';
  if (stack.language === 'Go') return 'Go';
  if (stack.language === 'Ruby') return 'Ruby';
  if (stack.language === 'Elixir' || stack.language === 'Erlang') return 'BEAM';
  if (stack.language === 'Dart') return 'Dart';
  if (stack.language === 'Swift') return 'Swift';
  if (stack.language === 'C#') return '.NET';
  if (stack.language === 'Java' || stack.language === 'Kotlin' || stack.language === 'Scala') return 'JVM';
  if (stack.language === 'TypeScript' || stack.language === 'JavaScript') {
    if (hasFile(scoped, 'bun.lockb') || hasFile(scoped, 'bun.lock') || hasFile(scoped, 'bunfig.toml')) return 'Bun';
    const pkg = safeJson(readPrimaryFileText(projectFiles, 'package.json')) ?? {};
    if (pkg.bun || (pkg.scripts && typeof (pkg.scripts as Record<string, string>).bun === 'string')) return 'Bun';
    if (hasFile(scoped, 'deno.json') || hasFile(scoped, 'deno.jsonc') || hasFile(scoped, 'deno.lock')) return 'Deno';
    return 'Node.js';
  }
  return 'Unknown';
}

export function detectPackageManager(files: DetectedFile[], projectFiles: ProjectFile[], language: Language): PackageManager {
  if (hasKernelSignatures(projectFiles)) return 'Unknown';
  const scoped = primaryDetectedFiles(files);
  if (hasRootFile(scoped, 'pnpm-lock.yaml')) return 'pnpm';
  if (hasRootFile(scoped, 'yarn.lock')) return 'yarn';
  if (hasRootFile(scoped, 'bun.lockb') || hasRootFile(scoped, 'bun.lock')) return 'bun';
  if (hasRootFile(scoped, 'package-lock.json')) return 'npm';
  const rootManagers: Array<[string, PackageManager]> = [['Cargo.toml', 'cargo'], ['go.mod', 'go-modules'], ['pom.xml', 'maven'], ['build.gradle', 'gradle'], ['build.gradle.kts', 'gradle'], ['composer.json', 'composer'], ['Gemfile', 'bundler'], ['mix.exs', 'mix'], ['pubspec.yaml', 'pub'], ['Package.swift', 'swift-package']];
  // A metadata-only package.json is not sufficient to override an explicit native
  // project manager. Real example: carbonyl has a Rust Cargo project and a
  // minimal root package.json containing name/version/license but no JS tooling.
  const nodePackage = safeJson(readPrimaryFileText(projectFiles, 'package.json'));
  const hasNodeTooling = Boolean(nodePackage && (
    ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'scripts']
      .some((key) => {
        const value = nodePackage[key];
        return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
      }) ||
    typeof nodePackage.packageManager === 'string' ||
    nodePackage.workspaces !== undefined
  ));
  if (hasRootFile(scoped, 'package.json') && hasNodeTooling) return 'npm';
  for (const [manifest, manager] of rootManagers) if (hasRootFile(scoped, manifest)) return manager;
  if (hasRootFile(scoped, 'package.json')) return 'npm';
  if (hasPrimaryFile(scoped, 'pyproject.toml')) {
    const content = readPrimaryFileText(projectFiles, 'pyproject.toml') ?? '';
    if (/\[tool\.poetry\]/i.test(content)) return 'poetry';
    if (/\[tool\.pdm\]/i.test(content)) return 'pdm';
    if (/\[tool\.pipenv\]/i.test(content)) return 'pipenv';
    if (/\[tool\.uv\]/i.test(content)) return 'uv';
    if (/\[tool\.hatch\]/i.test(content)) return 'hatch';
    // PEP 621 metadata alone does not identify the installer; corroborate with locks.
    if (hasPrimaryFile(scoped, 'uv.lock')) return 'uv';
    if (hasPrimaryFile(scoped, 'poetry.lock')) return 'poetry';
    if (hasPrimaryFile(scoped, 'pdm.lock')) return 'pdm';
    return 'pip';
  }
  if (hasPrimaryFile(scoped, 'uv.lock')) return 'uv';
  if (hasPrimaryFile(scoped, 'poetry.lock')) return 'poetry';
  if (hasPrimaryFile(scoped, 'pdm.lock')) return 'pdm';
  if (hasPrimaryFile(scoped, 'Pipfile') || hasPrimaryFile(scoped, 'Pipfile.lock')) return 'pipenv';
  if (hasPrimaryFile(scoped, 'requirements.txt') || hasPrimaryFile(scoped, 'requirements-dev.txt')) return 'pip';
  if (hasPrimaryFile(scoped, 'Cargo.toml')) return 'cargo';
  if (hasPrimaryFile(scoped, 'go.mod')) return 'go-modules';
  if (hasPrimaryFile(scoped, 'pom.xml')) return 'maven';
  if (hasPrimaryFile(scoped, 'build.gradle') || hasPrimaryFile(scoped, 'build.gradle.kts')) return 'gradle';
  if (hasPrimaryFile(scoped, 'composer.json')) return 'composer';
  if (hasPrimaryFile(scoped, 'Gemfile')) return 'bundler';
  if (hasPrimaryFile(scoped, 'mix.exs')) return 'mix';
  if (hasPrimaryFile(scoped, 'pubspec.yaml')) return 'pub';
  if (hasPrimaryFile(scoped, 'Package.swift')) return 'swift-package';
  if (hasPrimaryFile(scoped, 'build.sbt')) return 'sbt';
  if (hasPrimaryFile(scoped, 'packages.config') || projectFiles.some((f) => isProjectEvidenceFile(f) && isPrimaryProjectPath(f.path) && f.path.toLowerCase().endsWith('.csproj'))) return 'nuget';
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
export function detectBuildTool(files: DetectedFile[], projectFiles: ProjectFile[], stack: { framework: Framework; packageManager: PackageManager; language: Language }): BuildTool {
  const scoped = primaryDetectedFiles(files);
  if (hasKernelSignatures(projectFiles) && hasRootFile(scoped, 'Makefile') && (hasRootFile(scoped, 'Kbuild') || hasRootFile(scoped, 'Kconfig'))) return 'Kbuild';
  if (hasPrefix(scoped, 'vite.config.')) return 'Vite';
  if (hasPrefix(scoped, 'next.config.')) return 'Next.js';
  if (hasPrefix(scoped, 'nuxt.config.')) return 'Nuxt';
  if (hasPrefix(scoped, 'astro.config.')) return 'Astro';
  if (hasPrefix(scoped, 'remix.config.')) return 'Remix';
  if (hasPrefix(scoped, 'gatsby.config.')) return 'Gatsby';
  if (hasFile(scoped, 'angular.json')) return 'Angular CLI';
  if (hasPrimaryFile(scoped, 'Cargo.toml')) return 'Cargo';
  if (hasPrimaryFile(scoped, 'pom.xml')) return 'Maven';
  if (hasPrimaryFile(scoped, 'build.gradle') || hasPrimaryFile(scoped, 'build.gradle.kts')) return 'Gradle';
  if (hasPrimaryFile(scoped, 'CMakeLists.txt')) return 'CMake';
  if (stack.language === 'Python' && (hasPrimaryFile(scoped, 'pyproject.toml') || hasPrimaryFile(scoped, 'requirements.txt') || hasPrimaryFile(scoped, 'requirements-dev.txt'))) {
    const config = readPrimaryFileText(projectFiles, 'pyproject.toml') ?? '';
    const backend = pythonMetadataValue(config, 'build-system', 'build-backend') ?? '';
    if (backend.startsWith('flit_core.')) return 'Flit';
    if (backend.startsWith('setuptools.')) return 'Setuptools';
    if (backend.startsWith('hatchling.')) return 'hatch';
    if (backend.startsWith('poetry.')) return 'poetry';
    if (backend.startsWith('pdm.')) return 'PDM';
    if (stack.packageManager === 'poetry') return 'poetry';
    if (stack.packageManager === 'hatch') return 'hatch';
    if (!hasPrimaryFile(scoped, 'Makefile')) return 'pip';
  }
  if (hasPrimaryFile(scoped, 'Makefile')) return 'Make';
  if (hasPrimaryFile(scoped, 'Package.swift')) return 'Swift Package Manager';
  if (hasPrimaryFile(scoped, 'mix.exs')) return 'Mix';
  if (hasPrimaryFile(scoped, 'pubspec.yaml')) return 'Pub';
  if (hasFile(scoped, 'turbo.json')) return 'Turbo';
  if (hasPrefix(scoped, 'webpack.config.')) return 'Webpack';
  if (hasPrefix(scoped, 'rollup.config.')) return 'Rollup';
  if (hasPrefix(scoped, 'esbuild.config.')) return 'esbuild';
  if (scoped.some((file) => /(?:^|\/)hardhat\.config\.(?:[cm]?[jt]s)$/i.test(file.path))) return 'Hardhat';
  if (stack.language === 'Python') return 'pip';
  if (stack.language === 'Rust') return 'Cargo';
  if (stack.language === 'Go') return 'Unknown';
  if (stack.language === 'C++') return 'CMake';
  if (stack.language === 'Swift') return 'Swift Package Manager';
  if (stack.language === 'Elixir') return 'Mix';
  if (stack.language === 'Dart') return 'Pub';
  // React does not imply Create React App; only explicit build configuration can identify it.
  if (stack.framework === 'React') return 'Unknown';
  return 'Unknown';
}

const FRONTEND_FRAMEWORKS: Framework[] = [
  'Next.js', 'Nuxt', 'Astro', 'Remix', 'Gatsby', 'React', 'Vue', 'Angular',
  'Svelte', 'SvelteKit', 'Solid', 'Qwik', 'Preact', 'Alpine.js', 'Lit', 'Stencil', 'Flutter',
];

const BACKEND_FRAMEWORKS: Framework[] = [
  'Express', 'NestJS', 'Fastify', 'Hono', 'Fiber', 'Echo', 'Chi', 'Django', 'Flask', 'FastAPI',
  'Spring Boot', 'Quarkus', 'Ktor', 'Micronaut', 'Actix', 'Axum', 'Rocket', 'Rails', 'Sinatra',
  'Phoenix', 'Vapor', 'Revel', 'Play Framework', 'Laravel', 'Symfony', 'Gin',
];

export function detectMonorepo(detectedFiles: DetectedFile[], projectFiles: ProjectFile[]): MonorepoTool | 'None' {
  if (projectFiles.some(file => file.path === 'Cargo.toml' && /^\s*\[workspace\]\s*(?:#.*)?$/m.test(file.content ?? ''))) return 'Cargo Workspaces';
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
    } catch {}
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
  detectedFiles: DetectedFile[], projectFiles: ProjectFile[], language: Language, framework: Framework,
  runtime: Runtime, packageManager: PackageManager, buildTool: BuildTool
): DetectionConfidence {
  const scoped = primaryDetectedFiles(detectedFiles);
  const hasManifest = (names: string[]) => scoped.some((f) => names.some((n) => f.path === n || f.path.endsWith('/' + n)));
  const hasExt = (ext: string) => projectFiles.some((f) => isProjectEvidenceFile(f) && isLikelySourceRoot(f.path) && f.path.toLowerCase().endsWith(ext.toLowerCase()));
  const byteTotals = tallyLanguageBytes(projectFiles);
  const sortedBytes = Array.from(byteTotals.entries()).sort((a, b) => b[1] - a[1]);
  const topLangByBytes = sortedBytes[0]?.[0];
  const topBytes = sortedBytes[0]?.[1] ?? 0;
  const secondBytes = sortedBytes[1]?.[1] ?? 0;
  const volumeDominant = topBytes > 0 && topBytes >= secondBytes * 4 && topBytes > 50_000;
  const volumeMismatch = volumeDominant && topLangByBytes !== language;

  let languageConfidence = 50;
  const strongLanguageManifests: Partial<Record<Language, string[]>> = {
    TypeScript: ['tsconfig.json'], JavaScript: ['package.json'], Python: ['pyproject.toml', 'setup.py', 'requirements.txt'],
    Rust: ['Cargo.toml'], Go: ['go.mod'], Java: ['pom.xml', 'build.gradle'], Kotlin: ['build.gradle.kts'],
    C: ['Kconfig', 'Kbuild', 'CMakeLists.txt'], 'C++': ['CMakeLists.txt'], PHP: ['composer.json'], Ruby: ['Gemfile'],
    Elixir: ['mix.exs'], Dart: ['pubspec.yaml'], Swift: ['Package.swift'], Scala: ['build.sbt'], 'C#': ['packages.config'],
    Zig: ['build.zig', 'build.zig.zon'], OCaml: ['dune-project', 'dune-workspace', 'opam'], Haskell: ['stack.yaml', 'cabal.project', 'package.yaml'],
    Lua: ['.luacheckrc'], Julia: ['Project.toml'], R: ['DESCRIPTION', 'NAMESPACE', 'renv.lock'], Crystal: ['shard.yml'], Nim: ['nimble'],
    Solidity: ['foundry.toml', 'hardhat.config.js', 'hardhat.config.ts'], V: ['v.mod'], Perl: ['cpanfile', 'Makefile.PL', 'Build.PL'],
    Erlang: ['rebar.config', 'rebar3'],
  };
  const manifests = strongLanguageManifests[language] ?? [];
  if (manifests.length && hasManifest(manifests)) languageConfidence = 100;
  else if (hasExt('.' + language.toLowerCase().replace('#', ''))) languageConfidence = 80;
  else if (language !== 'Unknown') languageConfidence = 70;
  if (volumeMismatch) languageConfidence = Math.min(languageConfidence, 45);

  let frameworkConfidence = 50;
  const pkgContent = readPrimaryFileText(projectFiles, 'package.json');
  let pkgDeps: Record<string, string> = {};
  if (pkgContent) {
    try { const p = JSON.parse(pkgContent); pkgDeps = { ...(p.dependencies ?? {}), ...(p.devDependencies ?? {}) }; } catch {}
  }
  if (framework !== 'Unknown') {
    const configBased = scoped.some((f) => /next\.config|nuxt\.config|astro\.config|remix\.config|gatsby\.config|angular\.json|svelte\.config/.test(f.path));
    const frameworkPackages: Partial<Record<Framework, string[]>> = {
      'Next.js': ['next'], Nuxt: ['nuxt'], Astro: ['astro'], Remix: ['@remix-run/react'],
      Gatsby: ['gatsby'], Angular: ['@angular/core'], SvelteKit: ['@sveltejs/kit'],
      Svelte: ['svelte'], React: ['react'], Vue: ['vue'], Solid: ['solid-js'],
      Express: ['express'], Fastify: ['fastify'], NestJS: ['@nestjs/core'],
      Hono: ['hono'], Qwik: ['@builder.io/qwik'], Preact: ['preact'],
      'Alpine.js': ['alpinejs'], Lit: ['lit'], Stencil: ['@stencil/core'],
    };
    const depBased = (frameworkPackages[framework] ?? []).some((name) => Boolean(pkgDeps[name]));
    if (configBased) frameworkConfidence = 99; else if (depBased) frameworkConfidence = 95; else frameworkConfidence = 75;
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
    const configBased = scoped.some((f) => /vite\.config|next\.config|nuxt\.config|astro\.config|remix\.config|gatsby\.config|angular\.json|webpack\.config|rollup\.config|esbuild\.config|hardhat\.config|Cargo\.toml|pom\.xml|build\.gradle|CMakeLists\.txt|Makefile|Kbuild|Kconfig|turbo\.json/.test(f.path));
    buildConfidence = configBased ? 98 : 75;
  }
  return { language: languageConfidence, framework: frameworkConfidence, runtime: runtimeConfidence, packageManager: pmConfidence, buildTool: buildConfidence };
}

export function detectStack(projectFiles: ProjectFile[], detectedFiles: DetectedFile[]): TechnologyStack {
  const language = detectLanguage(detectedFiles, projectFiles);
  const framework = detectFramework(detectedFiles, projectFiles);
  const runtime = detectRuntime(detectedFiles, projectFiles, { language, framework });
  const packageManager = detectPackageManager(detectedFiles, projectFiles, language);
  const buildTool = detectBuildTool(detectedFiles, projectFiles, { framework, packageManager, language });
  const frontend: Framework | 'None' | 'Unknown' = FRONTEND_FRAMEWORKS.includes(framework) ? framework : 'Unknown';
  const backend: Framework | 'None' | 'Unknown' = BACKEND_FRAMEWORKS.includes(framework) ? framework : 'None';
  const database: TechnologyStack['database'] = (() => {
    if (hasKernelSignatures(projectFiles)) return 'Unknown';
    const evidenceFiles = projectFiles.filter((file) => {
      if (file.isDirectory || !isPrimaryProjectPath(file.path) || !isProjectEvidenceFile(file)) return false;
      const path = file.path.toLowerCase();
      return /(?:^|\/)(?:package\.json|pyproject\.toml|requirements(?:-dev)?\.txt|cargo\.toml|go\.mod|pom\.xml|build\.gradle(?:\.kts)?|composer\.json|gemfile|docker-compose\.ya?ml|compose\.ya?ml|\.env(?:\.[^/]*)?|[^/]*database[^/]*\.(?:json|ya?ml|toml)|schema\.prisma|redis\.conf)$/i.test(path);
    });
    const paths = evidenceFiles.map((file) => file.path.toLowerCase());
    const has = (pattern: RegExp) => paths.some((path) => pattern.test(path));
    const text = evidenceFiles.map((file) => file.content ?? '').join('\n');
    if (has(/(?:^|\/)supabase(?:\/|$)|supabase\.toml$/) || /\bsupabase\b/i.test(text)) return 'Supabase';
    if (has(/(?:^|\/)(?:firebase|firestore)(?:\/|$)/) || /\b(?:firebase|firestore)\b/i.test(text)) return 'Firebase';
    if (has(/redis\.conf$/) || /\b(?:ioredis|redis:\/\/|REDIS_URL|["']redis["']\s*:)/i.test(text)) return 'Redis';
    if (/\b(?:@elastic\/elasticsearch|elasticsearch|ELASTICSEARCH_URL)\b/i.test(text)) return 'Elasticsearch';
    if (/\bopensearch\b/i.test(text)) return 'OpenSearch';
    if (/\b(?:postgres(?:ql)?|postgres:\/\/|DATABASE_URL[^\n]*postgres|["']pg["']\s*:)/i.test(text)) return 'PostgreSQL';
    if (/\b(?:mysql2?|mysql:\/\/)/i.test(text)) return 'MySQL';
    if (/\bmariadb\b/i.test(text)) return 'MariaDB';
    if (/\b(?:sqlite3?|sqlite:\/\/)/i.test(text)) return 'SQLite';
    if (/\b(?:mongodb|mongoose|mongodb\+srv:\/\/)/i.test(text)) return 'MongoDB';
    if (/\bcassandra(?:-driver)?\b/i.test(text)) return 'Cassandra';
    if (/\b(?:dynamodb|@aws-sdk\/client-dynamodb)\b/i.test(text)) return 'DynamoDB';
    if (/\bcockroachdb?\b/i.test(text)) return 'CockroachDB';
    if (/\bneo4j\b/i.test(text)) return 'Neo4j';
    if (/\b(?:prisma|drizzle|sequelize|typeorm|knex|mikro-orm|alembic|sqlx|golang-migrate|dbmate|hasura|memcached)\b/i.test(text) || has(/schema\.prisma$/)) return 'Detected';
    return 'Unknown';
  })();
  const monorepo = detectMonorepo(detectedFiles, projectFiles);
  const cloudProvider = detectCloudProvider(detectedFiles);
  const confidence = computeConfidence(detectedFiles, projectFiles, language, framework, runtime, packageManager, buildTool);
  return { language, framework, runtime, packageManager, buildTool, frontend, backend, database, configFiles: detectedFiles.map((f) => f.path), monorepo, cloudProvider, confidence };
}

export function buildSummary(name: string, projectFiles: ProjectFile[], detectedFiles: DetectedFile[], stack: TechnologyStack, scanStats: ScanStats): ProjectSummary {
  const foldersScanned = new Set(projectFiles.filter((f) => f.isDirectory).map((f) => f.path)).size;
  const filesFound = Math.max(scanStats.filesFound || 0, scanStats.filesAnalyzed || 0);
  const filesAnalyzed = scanStats.filesAnalyzed || projectFiles.filter((f) => !f.isDirectory).length;
  const fileCoveragePercent = filesFound > 0 ? Math.min(100, Math.round((filesAnalyzed / filesFound) * 1000) / 10) : 100;
  const analysisCoverage = { status: (scanStats.sampled || scanStats.truncated) ? 'partial' as const : 'full' as const, filesAnalyzed, filesFound, fileCoveragePercent, filesWithContent: scanStats.filesWithContent ?? projectFiles.filter((f) => !f.isDirectory && f.content !== undefined).length, reason: scanStats.truncationReason };
  return { name, framework: stack.framework, language: stack.language, runtime: stack.runtime, packageManager: stack.packageManager, detectedConfigFiles: detectedFiles.map((f) => f.path), filesScanned: projectFiles.filter((f) => !f.isDirectory).length, foldersScanned, scanStats, analysisCoverage };
}
