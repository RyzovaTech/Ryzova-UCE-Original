import type { ProjectFile } from './types';

export type ProjectFileScope = 'production' | 'test' | 'fixture' | 'generated' | 'vendor' | 'documentation' | 'configuration';

const TEST_PATH_RE = /(^|\/)(?:__tests__|tests?|specs?|e2e(?:-tests)?)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i;
const FIXTURE_PATH_RE = /(^|\/)(?:fixtures?|mocks?|samples?|examples?|storybook|stories|benchmarks?)(?:\/|$)/i;
const GENERATED_PATH_RE = /(^|\/)(?:dist|build|out|coverage|generated|autogen|\.next|\.nuxt|\.svelte-kit|target)(?:\/|$)|\.(?:min\.js|map)$/i;
const VENDOR_PATH_RE = /(^|\/)(?:node_modules|vendor|third_party|pods|carthage)(?:\/|$)/i;
const DOCUMENTATION_PATH_RE = /(^|\/)(?:docs?|documentation)(?:\/|$)|(^|\/)(?:readme|changelog|contributing|security|license)(?:\.[^/]*)?$/i;
const CONFIG_BASENAME_RE = /^(?:package\.json|pyproject\.toml|requirements(?:-dev)?\.txt|cargo\.toml|go\.mod|pom\.xml|composer\.json|gemfile|mix\.exs|pubspec\.yaml|package\.swift|build\.sbt|[^/]+\.config\.[^/]+|tsconfig(?:\.[^/]+)?\.json|dockerfile(?:\.[^/]+)?|docker-compose\.[^/]+|\.env(?:\.[^/]+)?|[^/]+\.lock)$/i;

export function normalizeProjectPath(path: string): string {
  return path.replace(/^\.\//, '').replace(/\\/g, '/');
}

export function classifyProjectFileScope(path: string): ProjectFileScope {
  const normalized = normalizeProjectPath(path);
  if (VENDOR_PATH_RE.test(normalized)) return 'vendor';
  if (GENERATED_PATH_RE.test(normalized)) return 'generated';
  if (TEST_PATH_RE.test(normalized)) return 'test';
  if (FIXTURE_PATH_RE.test(normalized)) return 'fixture';
  if (DOCUMENTATION_PATH_RE.test(normalized)) return 'documentation';
  const base = normalized.split('/').pop() ?? normalized;
  if (CONFIG_BASENAME_RE.test(base)) return 'configuration';
  return 'production';
}

export function isProjectEvidenceFile(file: ProjectFile): boolean {
  if (file.isDirectory) return false;
  const scope = classifyProjectFileScope(file.path);
  return scope === 'production' || scope === 'configuration';
}
