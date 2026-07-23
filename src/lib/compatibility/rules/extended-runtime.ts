import type { CompatibilityRule } from '../types';
import type { Issue } from '../../analyzer/types';
import { readFile } from './shared';

function extractVersion(content: string, key: string): string | null {
  const re = new RegExp(`${key}\\s*=\\s*['"]?([^'"\\s]+)`, 'i');
  const m = content.match(re);
  return m ? m[1] : null;
}

export const extendedRuntimeRules: CompatibilityRule[] = [
  {
    id: 'rust-edition-pinned',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.runtime !== 'Rust') return issues;
      const cargo = readFile(ctx, 'Cargo.toml');
      if (!cargo) return issues;
      if (!/\[package\][\s\S]*edition\s*=/.test(cargo)) {
        issues.push({
          id: 'rust-edition-missing',
          title: 'Rust edition not declared in Cargo.toml',
          category: 'runtime',
          severity: 'warning',
          description: 'Cargo.toml does not specify a Rust edition.',
          reason: 'Without an edition field, the compiler defaults to edition 2015, missing modern features.',
          recommendation: 'Add edition = "2021" to the [package] section.',
          affectedFile: 'Cargo.toml',
          detected: 'not declared',
          expected: 'edition = "2021"',
          impact: 'Modern Rust syntax and borrow-checker improvements are unavailable.',
          suggestedAction: 'Add edition = "2021" under [package] in Cargo.toml.',
        });
      }
      return issues;
    },
  },
  {
    id: 'go-version-pinned',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.runtime !== 'Go') return issues;
      const gomod = readFile(ctx, 'go.mod');
      if (!gomod) return issues;
      if (!/^go\s+\d+\.\d+/m.test(gomod)) {
        issues.push({
          id: 'go-version-missing',
          title: 'Go version not declared in go.mod',
          category: 'runtime',
          severity: 'warning',
          description: 'go.mod does not include a go directive.',
          reason: 'Without a go directive, the toolchain version is ambiguous.',
          recommendation: 'Add a go directive, e.g. "go 1.22".',
          affectedFile: 'go.mod',
          detected: 'not declared',
          expected: 'go 1.22+',
          impact: 'Module behavior and language features may differ across toolchains.',
          suggestedAction: 'Add "go 1.22" to go.mod.',
        });
      }
      return issues;
    },
  },
  {
    id: 'ruby-version-pinned',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.runtime !== 'Ruby') return issues;
      const rubyVersion = readFile(ctx, '.ruby-version');
      const gemfile = readFile(ctx, 'Gemfile');
      if (rubyVersion) return issues;
      if (gemfile && /ruby\s+['"]\d/.test(gemfile)) return issues;
      issues.push({
        id: 'ruby-version-missing',
        title: 'Ruby version not declared',
        category: 'runtime',
        severity: 'warning',
        description: 'No .ruby-version file or Gemfile ruby directive found.',
        reason: 'Without a version pin, contributors may use an unsupported Ruby.',
        recommendation: 'Add a .ruby-version file or a ruby "3.3" line in the Gemfile.',
        affectedFile: '.ruby-version',
        detected: 'not declared',
        expected: 'ruby 3.3+',
        impact: 'Gem compatibility and syntax support may vary.',
        suggestedAction: 'Create .ruby-version with the target Ruby version.',
      });
      return issues;
    },
  },
  {
    id: 'elixir-version-pinned',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.runtime !== 'BEAM') return issues;
      const mix = readFile(ctx, 'mix.exs');
      if (!mix) return issues;
      if (!/elixir.*['"]~>\s*\d/i.test(mix)) {
        issues.push({
          id: 'elixir-version-missing',
          title: 'Elixir version not declared in mix.exs',
          category: 'runtime',
          severity: 'info',
          description: 'mix.exs does not pin an Elixir version.',
          reason: 'Without a version constraint, older Elixir versions may be used.',
          recommendation: 'Add elixir: "~> 1.16" to the project/0 function.',
          affectedFile: 'mix.exs',
          detected: 'not declared',
          expected: 'elixir ~> 1.16',
          impact: 'Newer Elixir features may not be available.',
          suggestedAction: 'Add elixir: "~> 1.16" to mix.exs.',
        });
      }
      return issues;
    },
  },
  {
    id: 'swift-version-pinned',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.runtime !== 'Swift') return issues;
      const pkg = readFile(ctx, 'Package.swift');
      if (!pkg) return issues;
      if (!/swift-tools-version/i.test(pkg)) {
        issues.push({
          id: 'swift-tools-version-missing',
          title: 'swift-tools-version not declared in Package.swift',
          category: 'runtime',
          severity: 'warning',
          description: 'Package.swift does not declare a swift-tools-version.',
          reason: 'The tools version determines which SwiftPM features are available.',
          recommendation: 'Add // swift-tools-version: 5.9 at the top of Package.swift.',
          affectedFile: 'Package.swift',
          detected: 'not declared',
          expected: 'swift-tools-version: 5.9+',
          impact: 'SwiftPM may reject the package on newer toolchains.',
          suggestedAction: 'Add swift-tools-version: 5.9 to Package.swift.',
        });
      }
      return issues;
    },
  },
  {
    id: 'java-version-pinned',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.runtime !== 'JVM') return issues;
      const pom = readFile(ctx, 'pom.xml');
      const gradle = readFile(ctx, 'build.gradle') ?? readFile(ctx, 'build.gradle.kts');
      if (!pom && !gradle) return issues;
      const hasMavenTarget = pom && /<maven\.compiler\.(source|release|target)>/.test(pom);
      const hasGradleSource = gradle && /sourceCompatibility|JavaVersion|languageVersion/i.test(gradle);
      if (!hasMavenTarget && !hasGradleSource) {
        issues.push({
          id: 'java-version-missing',
          title: 'Java compiler version not declared',
          category: 'runtime',
          severity: 'warning',
          description: 'No maven.compiler.release or sourceCompatibility found.',
          reason: 'Without a compiler target, the build may use an unexpected JDK.',
          recommendation: 'Set maven.compiler.release to 17 or sourceCompatibility to 17.',
          affectedFile: pom ? 'pom.xml' : 'build.gradle',
          detected: 'not declared',
          expected: 'Java 17+',
          impact: 'Build may fail on CI if the JDK differs from local.',
          suggestedAction: 'Declare a compiler target in the build file.',
        });
      }
      return issues;
    },
  },
  {
    id: 'dotnet-target-framework',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.runtime !== '.NET') return issues;
      const csproj = ctx.files.find(
        (f) => !f.isDirectory && f.path.toLowerCase().endsWith('.csproj')
      );
      if (!csproj) return issues;
      const content = csproj.content ?? '';
      if (!/<TargetFramework/i.test(content)) {
        issues.push({
          id: 'dotnet-targetframework-missing',
          title: 'TargetFramework not declared in .csproj',
          category: 'runtime',
          severity: 'warning',
          description: 'The .csproj file does not specify a TargetFramework.',
          reason: 'Without a target framework, the build defaults may not match production.',
          recommendation: 'Add <TargetFramework>net8.0</TargetFramework> to the .csproj.',
          affectedFile: csproj.path,
          detected: 'not declared',
          expected: 'net8.0+',
          impact: 'Build may target an unsupported framework version.',
          suggestedAction: 'Add TargetFramework to the .csproj file.',
        });
      }
      return issues;
    },
  },
  {
    id: 'node-nvmrc-present',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.runtime !== 'Node.js') return issues;
      const hasNvmrc = ctx.detectedFiles.some(
        (f) => f.path === '.nvmrc' || f.path.endsWith('/.nvmrc')
      );
      const hasNodeVersion = ctx.detectedFiles.some(
        (f) => f.path === '.node-version' || f.path.endsWith('/.node-version')
      );
      if (!hasNvmrc && !hasNodeVersion) {
        issues.push({
          id: 'node-version-file-missing',
          title: 'No .nvmrc or .node-version file found',
          category: 'runtime',
          severity: 'info',
          description: 'A Node.js project without a version pin file.',
          reason: 'Version managers like nvm/fnm/volta use these files to auto-switch.',
          recommendation: 'Add an .nvmrc file with the Node version (e.g. "20").',
          affectedFile: '.nvmrc',
          detected: 'missing',
          expected: '.nvmrc present',
          impact: 'Contributors may run different Node versions locally.',
          suggestedAction: 'Create .nvmrc with the target Node version.',
        });
      }
      return issues;
    },
  },
  {
    id: 'bun-runtime-detected',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.runtime !== 'Bun') return issues;
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        if (!p.trustedDependencies && !p['trusted-dependencies']) {
          issues.push({
            id: 'bun-trusted-deps-missing',
            title: 'Bun trustedDependencies not set',
            category: 'runtime',
            severity: 'info',
            description: 'Bun uses trustedDependencies to restrict lifecycle scripts.',
            reason: 'Without it, all packages can run postinstall scripts by default.',
            recommendation: 'Add a "trustedDependencies" array to package.json.',
            affectedFile: 'package.json',
            detected: 'not set',
            expected: 'trustedDependencies array',
            impact: 'Postinstall scripts run without explicit trust.',
            suggestedAction: 'List trusted packages in trustedDependencies.',
          });
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'deno-config-present',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.runtime !== 'Deno') return issues;
      const hasConfig = ctx.detectedFiles.some(
        (f) => f.path === 'deno.json' || f.path.endsWith('/deno.json') ||
              f.path === 'deno.jsonc' || f.path.endsWith('/deno.jsonc')
      );
      if (!hasConfig) {
        issues.push({
          id: 'deno-config-missing',
          title: 'No deno.json/deno.jsonc found',
          category: 'runtime',
          severity: 'info',
          description: 'Deno project without a configuration file.',
          reason: 'deno.json configures imports, lint, and fmt settings.',
          recommendation: 'Add a deno.json with import map and task definitions.',
          affectedFile: 'deno.json',
          detected: 'missing',
          expected: 'deno.json present',
          impact: 'Import resolution and task runner are not configured.',
          suggestedAction: 'Create deno.json with configuration.',
        });
      }
      return issues;
    },
  },
  {
    id: 'python-eol-check',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.runtime !== 'Python') return issues;
      const pyproject = readFile(ctx, 'pyproject.toml');
      const setupPy = readFile(ctx, 'setup.py');
      const runtimeTxt = readFile(ctx, 'runtime.txt');
      const pythonVersion = readFile(ctx, '.python-version');
      let version: string | null = null;
      if (pyproject) version = extractVersion(pyproject, 'python_requires');
      if (!version && setupPy) version = extractVersion(setupPy, 'python_requires');
      if (!version && runtimeTxt) version = runtimeTxt.trim().match(/[\d.]+/)?.[0] ?? null;
      if (!version && pythonVersion) version = pythonVersion.trim();
      if (!version) return issues;
      const major = parseInt(version, 10);
      if (major <= 3 && version.startsWith('3.')) {
        const minor = parseInt(version.split('.')[1] ?? '0', 10);
        if (minor < 9) {
          issues.push({
            id: 'python-eol',
            title: 'Python version constraint targets an EOL release',
            category: 'runtime',
            severity: 'critical',
            description: `Declared Python "${version}" is end-of-life.`,
            reason: 'Python 3.7 and 3.8 no longer receive security patches.',
            recommendation: 'Bump the minimum to Python 3.11 or newer.',
            affectedFile: pyproject ? 'pyproject.toml' : '.python-version',
            detected: version,
            expected: '>=3.11',
            impact: 'Security vulnerabilities and missing stdlib features.',
            suggestedAction: 'Update python_requires to >=3.11.',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'dockerfile-python-outdated',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      const docker = ctx.detectedFiles.find((f) => f.path.endsWith('Dockerfile'));
      if (!docker) return issues;
      const content = readFile(ctx, 'Dockerfile');
      if (!content) return issues;
      const m = content.match(/FROM\s+python:(\d+)\.(\d+)/i);
      if (m) {
        const major = Number(m[1]);
        const minor = Number(m[2]);
        if (major === 3 && minor < 11) {
          issues.push({
            id: 'docker-python-outdated',
            title: 'Dockerfile pins an outdated Python image',
            category: 'runtime',
            severity: 'warning',
            description: `Dockerfile uses python:${major}.${minor} which is below the recommended baseline.`,
            reason: 'Older Python images may lack security patches.',
            recommendation: 'Bump the base image to python:3.12 or newer.',
            affectedFile: 'Dockerfile',
            detected: `python:${major}.${minor}`,
            expected: 'python:3.12+',
            impact: 'Container may inherit unpatched vulnerabilities.',
            suggestedAction: 'Update FROM python:3.12-slim (or equivalent).',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'dockerfile-go-outdated',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      const docker = ctx.detectedFiles.find((f) => f.path.endsWith('Dockerfile'));
      if (!docker) return issues;
      const content = readFile(ctx, 'Dockerfile');
      if (!content) return issues;
      const m = content.match(/FROM\s+golang:(\d+)\.(\d+)/i);
      if (m) {
        const major = Number(m[1]);
        const minor = Number(m[2]);
        if (major === 1 && minor < 21) {
          issues.push({
            id: 'docker-go-outdated',
            title: 'Dockerfile pins an outdated Go image',
            category: 'runtime',
            severity: 'warning',
            description: `Dockerfile uses golang:${major}.${minor} which is below the recommended baseline.`,
            reason: 'Older Go images may lack security patches.',
            recommendation: 'Bump the base image to golang:1.22 or newer.',
            affectedFile: 'Dockerfile',
            detected: `golang:${major}.${minor}`,
            expected: 'golang:1.22+',
            impact: 'Container may inherit unpatched vulnerabilities.',
            suggestedAction: 'Update FROM golang:1.22-alpine (or equivalent).',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'dockerfile-rust-outdated',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      const docker = ctx.detectedFiles.find((f) => f.path.endsWith('Dockerfile'));
      if (!docker) return issues;
      const content = readFile(ctx, 'Dockerfile');
      if (!content) return issues;
      const m = content.match(/FROM\s+rust:(\d+)/i);
      if (m) {
        const v = Number(m[1]);
        if (v > 0 && v < 1) {
          issues.push({
            id: 'docker-rust-outdated',
            title: 'Dockerfile pins an outdated Rust image',
            category: 'runtime',
            severity: 'info',
            description: `Dockerfile uses rust:${v}.`,
            reason: 'Older Rust images may miss compiler improvements.',
            recommendation: 'Use rust:latest or a specific edition tag.',
            affectedFile: 'Dockerfile',
            detected: `rust:${v}`,
            expected: 'rust:1.75+',
            impact: 'Compiler optimizations may be missing.',
            suggestedAction: 'Update FROM rust:1.75 or newer.',
          });
        }
      }
      return issues;
    },
  },
  {
    id: 'engines-bun-declared',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.runtime !== 'Bun') return issues;
      const pkg = readFile(ctx, 'package.json');
      if (!pkg) return issues;
      try {
        const p = JSON.parse(pkg);
        if (!p.engines?.bun) {
          issues.push({
            id: 'bun-engine-missing',
            title: 'Bun engine version not declared',
            category: 'runtime',
            severity: 'info',
            description: 'package.json does not declare engines.bun.',
            reason: 'Without it, contributors may run an incompatible Bun version.',
            recommendation: 'Add "engines": { "bun": ">=1.1" } to package.json.',
            affectedFile: 'package.json',
            detected: 'not declared',
            expected: '>=1.1',
            impact: 'Runtime behavior may differ across Bun versions.',
            suggestedAction: 'Add engines.bun to package.json.',
          });
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'engines-deno-declared',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.runtime !== 'Deno') return issues;
      const denoJson = readFile(ctx, 'deno.json');
      if (!denoJson) return issues;
      try {
        const p = JSON.parse(denoJson);
        if (!p.unstable && !p.tasks) {
          issues.push({
            id: 'deno-config-minimal',
            title: 'deno.json lacks tasks or configuration',
            category: 'runtime',
            severity: 'info',
            description: 'deno.json exists but has no tasks defined.',
            reason: 'Tasks improve developer experience with deno task commands.',
            recommendation: 'Add a "tasks" section with common scripts.',
            affectedFile: 'deno.json',
            detected: 'no tasks',
            expected: 'tasks section',
            impact: 'No standard way to run common operations.',
            suggestedAction: 'Add tasks to deno.json.',
          });
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'flutter-sdk-version',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.runtime !== 'Dart') return issues;
      const pubspec = readFile(ctx, 'pubspec.yaml');
      if (!pubspec) return issues;
      if (!/sdk:\s*['"]?flutter/i.test(pubspec)) {
        issues.push({
          id: 'flutter-sdk-missing',
          title: 'Flutter SDK constraint not declared in pubspec.yaml',
          category: 'runtime',
          severity: 'warning',
          description: 'pubspec.yaml does not include a Flutter SDK constraint.',
          reason: 'Without it, the project may not build with the intended Flutter version.',
          recommendation: 'Add "flutter: { sdk: flutter }" under environment.',
          affectedFile: 'pubspec.yaml',
          detected: 'not declared',
          expected: 'flutter sdk constraint',
          impact: 'Build may fail on different Flutter versions.',
          suggestedAction: 'Add Flutter SDK constraint to pubspec.yaml.',
        });
      }
      return issues;
    },
  },
  {
    id: 'c-cpp-standard-pinned',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.language !== 'C++') return issues;
      const cmake = readFile(ctx, 'CMakeLists.txt');
      if (!cmake) return issues;
      if (!/CMAKE_CXX_STANDARD|cxx_std_/i.test(cmake)) {
        issues.push({
          id: 'cpp-standard-missing',
          title: 'C++ standard not declared in CMakeLists.txt',
          category: 'runtime',
          severity: 'warning',
          description: 'CMakeLists.txt does not set CMAKE_CXX_STANDARD.',
          reason: 'Without a standard, the compiler defaults may vary.',
          recommendation: 'Set CMAKE_CXX_STANDARD to 17 or higher.',
          affectedFile: 'CMakeLists.txt',
          detected: 'not declared',
          expected: 'C++17+',
          impact: 'Modern C++ features may not compile.',
          suggestedAction: 'Add set(CMAKE_CXX_STANDARD 17) to CMakeLists.txt.',
        });
      }
      return issues;
    },
  },
  {
    id: 'php-version-pinned',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.language !== 'PHP') return issues;
      const composer = readFile(ctx, 'composer.json');
      if (!composer) return issues;
      try {
        const p = JSON.parse(composer);
        if (!p.require?.php && !p.require?.['php-64bit']) {
          issues.push({
            id: 'php-version-missing',
            title: 'PHP version constraint not declared in composer.json',
            category: 'runtime',
            severity: 'warning',
            description: 'composer.json does not require a specific PHP version.',
            reason: 'Without it, the project may run on an unsupported PHP.',
            recommendation: 'Add "php": ">=8.2" to the require section.',
            affectedFile: 'composer.json',
            detected: 'not declared',
            expected: '>=8.2',
            impact: 'Compatibility with newer PHP features is not guaranteed.',
            suggestedAction: 'Add a PHP version constraint to composer.json.',
          });
        }
      } catch {
        // ignore
      }
      return issues;
    },
  },
  {
    id: 'scala-version-pinned',
    category: 'runtime',
    run: (ctx) => {
      const issues: Issue[] = [];
      if (ctx.stack.language !== 'Scala') return issues;
      const sbt = readFile(ctx, 'build.sbt');
      const buildProps = readFile(ctx, 'build.properties');
      if (!sbt && !buildProps) return issues;
      if (sbt && !/scalaVersion\s*:=/i.test(sbt)) {
        issues.push({
          id: 'scala-version-missing',
          title: 'Scala version not declared in build.sbt',
          category: 'runtime',
          severity: 'warning',
          description: 'build.sbt does not set scalaVersion.',
          reason: 'Without it, the default Scala version may not match expectations.',
          recommendation: 'Add scalaVersion := "3.3.3" to build.sbt.',
          affectedFile: 'build.sbt',
          detected: 'not declared',
          expected: 'Scala 3.3+',
          impact: 'Library compatibility may differ.',
          suggestedAction: 'Set scalaVersion in build.sbt.',
        });
      }
      return issues;
    },
  },
];
