import type { ProjectFile, DetectedFile } from './types';

const KNOWN_FILES: Record<string, { kind: string; purpose: string }> = {
  // Node / JS / TS
  'package.json': { kind: 'manifest', purpose: 'Node.js project manifest' },
  'package-lock.json': { kind: 'lockfile', purpose: 'npm dependency lock' },
  'pnpm-lock.yaml': { kind: 'lockfile', purpose: 'pnpm dependency lock' },
  'yarn.lock': { kind: 'lockfile', purpose: 'yarn dependency lock' },
  'bun.lockb': { kind: 'lockfile', purpose: 'Bun dependency lock' },
  'bun.lock': { kind: 'lockfile', purpose: 'Bun dependency lock' },
  'tsconfig.json': { kind: 'config', purpose: 'TypeScript configuration' },
  'tsconfig.app.json': { kind: 'config', purpose: 'TypeScript app config' },
  'tsconfig.node.json': { kind: 'config', purpose: 'TypeScript node config' },
  '.nvmrc': { kind: 'config', purpose: 'Node.js version pin' },
  '.node-version': { kind: 'config', purpose: 'Node.js version pin' },
  // Python
  'requirements.txt': { kind: 'manifest', purpose: 'Python pip requirements' },
  'requirements-dev.txt': { kind: 'manifest', purpose: 'Python dev requirements' },
  'pyproject.toml': { kind: 'manifest', purpose: 'Python project config' },
  'setup.py': { kind: 'manifest', purpose: 'Python setup script' },
  'setup.cfg': { kind: 'config', purpose: 'Python setup config' },
  'Pipfile': { kind: 'manifest', purpose: 'Pipenv manifest' },
  'Pipfile.lock': { kind: 'lockfile', purpose: 'Pipenv lock' },
  'pdm.lock': { kind: 'lockfile', purpose: 'Pdm lock' },
  'uv.lock': { kind: 'lockfile', purpose: 'uv lock' },
  'poetry.lock': { kind: 'lockfile', purpose: 'Poetry lock' },
  '.python-version': { kind: 'config', purpose: 'Python version pin' },
  'runtime.txt': { kind: 'config', purpose: 'Python runtime version' },
  // Rust
  'Cargo.toml': { kind: 'manifest', purpose: 'Rust cargo manifest' },
  'Cargo.lock': { kind: 'lockfile', purpose: 'Rust cargo lock' },
  // Go
  'go.mod': { kind: 'manifest', purpose: 'Go modules manifest' },
  'go.sum': { kind: 'lockfile', purpose: 'Go modules checksum' },
  // Java / Kotlin / JVM
  'pom.xml': { kind: 'manifest', purpose: 'Maven POM' },
  'build.gradle': { kind: 'config', purpose: 'Gradle build config' },
  'build.gradle.kts': { kind: 'config', purpose: 'Gradle Kotlin build config' },
  'settings.gradle': { kind: 'config', purpose: 'Gradle settings' },
  'gradle.properties': { kind: 'config', purpose: 'Gradle properties' },
  // PHP
  'composer.json': { kind: 'manifest', purpose: 'PHP composer manifest' },
  'composer.lock': { kind: 'lockfile', purpose: 'PHP composer lock' },
  // Ruby
  'Gemfile': { kind: 'manifest', purpose: 'Ruby bundler manifest' },
  'Gemfile.lock': { kind: 'lockfile', purpose: 'Ruby bundler lock' },
  '.ruby-version': { kind: 'config', purpose: 'Ruby version pin' },
  // Elixir
  'mix.exs': { kind: 'manifest', purpose: 'Elixir mix manifest' },
  'mix.lock': { kind: 'lockfile', purpose: 'Elixir mix lock' },
  // Dart / Flutter
  'pubspec.yaml': { kind: 'manifest', purpose: 'Dart pub manifest' },
  'pubspec.lock': { kind: 'lockfile', purpose: 'Dart pub lock' },
  // C / C++
  'CMakeLists.txt': { kind: 'config', purpose: 'CMake build config' },
  'Makefile': { kind: 'config', purpose: 'Make build config' },
  // Swift
  'Package.swift': { kind: 'manifest', purpose: 'Swift package manifest' },
  // Scala
  'build.sbt': { kind: 'manifest', purpose: 'Scala sbt build' },
  // .NET / C#
  'csproj': { kind: 'manifest', purpose: '.NET project file' },
  'packages.config': { kind: 'manifest', purpose: 'NuGet packages' },
  // Container / env
  'Dockerfile': { kind: 'container', purpose: 'Container image definition' },
  'docker-compose.yml': { kind: 'container', purpose: 'Multi-container orchestration' },
  'docker-compose.yaml': { kind: 'container', purpose: 'Multi-container orchestration' },
  'docker-compose.override.yml': { kind: 'container', purpose: 'Docker compose override' },
  '.env.example': { kind: 'environment', purpose: 'Environment variable template' },
  '.env.local': { kind: 'environment', purpose: 'Local environment variables' },
  '.env': { kind: 'environment', purpose: 'Environment variables' },
  // Docs
  'README.md': { kind: 'docs', purpose: 'Project documentation' },
  'README.txt': { kind: 'docs', purpose: 'Project documentation' },
  'README.rst': { kind: 'docs', purpose: 'Project documentation' },
  'LICENSE': { kind: 'docs', purpose: 'License file' },
  'LICENSE.md': { kind: 'docs', purpose: 'License file' },
  'CHANGELOG.md': { kind: 'docs', purpose: 'Changelog' },
  'CONTRIBUTING.md': { kind: 'docs', purpose: 'Contribution guide' },
  // Misc config
  '.gitignore': { kind: 'config', purpose: 'Git ignore rules' },
  '.editorconfig': { kind: 'config', purpose: 'Editor config' },
  '.prettierrc': { kind: 'config', purpose: 'Prettier config' },
  '.eslintrc': { kind: 'config', purpose: 'ESLint config' },
  '.eslintrc.json': { kind: 'config', purpose: 'ESLint config' },
  '.eslintrc.js': { kind: 'config', purpose: 'ESLint config' },
  '.eslintrc.cjs': { kind: 'config', purpose: 'ESLint config' },
  '.babelrc': { kind: 'config', purpose: 'Babel config' },
  'jest.config.js': { kind: 'config', purpose: 'Jest config' },
  'jest.config.ts': { kind: 'config', purpose: 'Jest config' },
  'vitest.config.ts': { kind: 'config', purpose: 'Vitest config' },
  'vitest.config.js': { kind: 'config', purpose: 'Vitest config' },
  'turbo.json': { kind: 'config', purpose: 'Turborepo config' },
  'svelte.config.js': { kind: 'config', purpose: 'Svelte config' },
  'svelte.config.mjs': { kind: 'config', purpose: 'Svelte config' },
  'astro.config.mjs': { kind: 'config', purpose: 'Astro config' },
  'astro.config.js': { kind: 'config', purpose: 'Astro config' },
  'remix.config.js': { kind: 'config', purpose: 'Remix config' },
  'gatsby-config.js': { kind: 'config', purpose: 'Gatsby config' },
  'gatsby-config.ts': { kind: 'config', purpose: 'Gatsby config' },
  'angular.json': { kind: 'config', purpose: 'Angular CLI config' },
  'next.config.js': { kind: 'config', purpose: 'Next.js config' },
  'next.config.mjs': { kind: 'config', purpose: 'Next.js config' },
  'next.config.ts': { kind: 'config', purpose: 'Next.js config' },
  'nuxt.config.ts': { kind: 'config', purpose: 'Nuxt config' },
  'nuxt.config.js': { kind: 'config', purpose: 'Nuxt config' },
  'vite.config.ts': { kind: 'config', purpose: 'Vite build config' },
  'vite.config.js': { kind: 'config', purpose: 'Vite build config' },
  'vite.config.mjs': { kind: 'config', purpose: 'Vite build config' },
  'webpack.config.js': { kind: 'config', purpose: 'Webpack config' },
  'webpack.config.ts': { kind: 'config', purpose: 'Webpack config' },
  'rollup.config.js': { kind: 'config', purpose: 'Rollup config' },
  'rollup.config.mjs': { kind: 'config', purpose: 'Rollup config' },
  'esbuild.config.js': { kind: 'config', purpose: 'esbuild config' },
  'tailwind.config.js': { kind: 'config', purpose: 'Tailwind CSS config' },
  'tailwind.config.ts': { kind: 'config', purpose: 'Tailwind CSS config' },
  'postcss.config.js': { kind: 'config', purpose: 'PostCSS config' },
  'postcss.config.mjs': { kind: 'config', purpose: 'PostCSS config' },
  'eslint.config.js': { kind: 'config', purpose: 'ESLint flat config' },
  'eslint.config.mjs': { kind: 'config', purpose: 'ESLint flat config' },
  'babel.config.js': { kind: 'config', purpose: 'Babel config' },
  'prisma/schema.prisma': { kind: 'config', purpose: 'Prisma schema' },
  // Monorepo
  'nx.json': { kind: 'monorepo', purpose: 'Nx workspace config' },
  'lerna.json': { kind: 'monorepo', purpose: 'Lerna config' },
  'rush.json': { kind: 'monorepo', purpose: 'Rush monorepo config' },
  'pnpm-workspace.yaml': { kind: 'monorepo', purpose: 'pnpm workspace config' },
  // Cloud providers
  'vercel.json': { kind: 'cloud', purpose: 'Vercel deployment config' },
  'netlify.toml': { kind: 'cloud', purpose: 'Netlify deployment config' },
  'railway.json': { kind: 'cloud', purpose: 'Railway deployment config' },
  'railway.toml': { kind: 'cloud', purpose: 'Railway deployment config' },
  'fly.toml': { kind: 'cloud', purpose: 'Fly.io deployment config' },
  'render.yaml': { kind: 'cloud', purpose: 'Render deployment config' },
  'wrangler.toml': { kind: 'cloud', purpose: 'Cloudflare Workers config' },
  'wrangler.json': { kind: 'cloud', purpose: 'Cloudflare Workers config' },
  // Security
  'SECURITY.md': { kind: 'security', purpose: 'Security policy' },
  // Helm
  'Chart.yaml': { kind: 'helm', purpose: 'Helm chart definition' },
  'values.yaml': { kind: 'helm', purpose: 'Helm chart values' },
};

const GLOBBISH_CONFIG = [
  'vite.config.',
  'next.config.',
  'nuxt.config.',
  'svelte.config.',
  'astro.config.',
  'remix.config.',
  'gatsby.config.',
  'webpack.config.',
  'rollup.config.',
  'esbuild.config.',
  'jest.config.',
  'vitest.config.',
  'tailwind.config.',
  'postcss.config.',
  'eslint.config.',
  '.eslintrc',
  '.prettierrc',
  'babel.config.',
  '.babelrc',
  'tsconfig.',
  'docker-compose.',
  'Dockerfile.',
];

export function detectKnownFile(path: string): { kind: string; purpose: string } | null {
  const base = path.split('/').pop() ?? path;
  if (KNOWN_FILES[base]) return KNOWN_FILES[base];
  // Dockerfile variants: Dockerfile.dev, Dockerfile.production, etc.
  if (base === 'Dockerfile' || base.startsWith('Dockerfile.')) {
    return { kind: 'container', purpose: 'Container image definition' };
  }
  // docker-compose.* variants
  if (base.startsWith('docker-compose.') || base.startsWith('compose.')) {
    return { kind: 'container', purpose: 'Multi-container orchestration' };
  }
  // .env.* files (but not .env.example which is in KNOWN_FILES)
  if (base.startsWith('.env.') && base !== '.env.example') {
    return { kind: 'environment', purpose: 'Environment variables' };
  }
  // .csproj files (C# project files, e.g. App.csproj)
  if (base.toLowerCase().endsWith('.csproj')) {
    return { kind: 'manifest', purpose: '.NET project file' };
  }
  for (const prefix of GLOBBISH_CONFIG) {
    if (base.startsWith(prefix)) {
      return { kind: 'config', purpose: `${prefix.replace(/[._]$/, '')} configuration` };
    }
  }
  return null;
}

export function parseFiles(files: ProjectFile[]): DetectedFile[] {
  const detected: DetectedFile[] = [];
  for (const file of files) {
    if (file.isDirectory) continue;
    const known = detectKnownFile(file.path);
    if (known) {
      detected.push({ path: file.path, size: file.size, kind: known.kind, purpose: known.purpose });
    }
  }
  return detected.sort((a, b) => a.path.localeCompare(b.path));
}
