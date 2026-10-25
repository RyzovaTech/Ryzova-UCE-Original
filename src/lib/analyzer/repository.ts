export type RepositoryProvider = 'github' | 'gitlab' | 'codeberg';

export interface PublicRepository {
  provider: RepositoryProvider;
  /** Provider-specific namespace including GitLab subgroups. */
  namespace: string[];
  owner: string;
  repository: string;
  metadataUrl: string;
  displayUrl: string;
}
export type GitHubRepository = PublicRepository;

const PROVIDERS: Record<string, RepositoryProvider> = {
  'github.com': 'github',
  'gitlab.com': 'gitlab',
  'codeberg.org': 'codeberg',
};
const SEGMENT = /^[A-Za-z0-9_.-]+$/;

/** Explicit host allowlist, no arbitrary remote URL/credential access. */
export function parseRepositoryUrl(value: string): PublicRepository {
  const input = value.trim();
  if (input.length > 350 || /[\u0000-\u001f\u007f%\\]/.test(input)) {
    throw new Error('Use a normal public GitHub, GitLab, or Codeberg repository URL.');
  }
  const ssh = input.match(/^git@(github\.com|gitlab\.com|codeberg\.org):([A-Za-z0-9_.\/-]+?)(?:\.git)?\/?$/i);
  const normalized = ssh ? 'https://' + ssh[1] + '/' + ssh[2] : input;
  let url: URL;
  try { url = new URL(normalized); }
  catch { throw new Error('Enter a public GitHub, GitLab, or Codeberg repository URL.'); }
  const provider = PROVIDERS[url.hostname.toLowerCase()];
  if (!provider || url.protocol !== 'https:' || url.username || url.password ||
      url.port || url.search || url.hash) {
    throw new Error('Only public HTTPS GitHub, GitLab, or Codeberg repository roots are supported.');
  }
  const rawSegments = url.pathname.replace(/\/$/, '').split('/').slice(1);
  if (rawSegments.length < 2 || rawSegments.length > (provider === 'gitlab' ? 8 : 2) ||
      rawSegments.some(part => !SEGMENT.test(part) || part === '.' || part === '..' || part === '-')) {
    throw new Error('Enter a repository root URL, not a branch, file path, or unsafe URL.');
  }
  const namespace = [...rawSegments];
  const repository = namespace.pop()!.replace(/\.git$/i, '');
  if (!repository || repository === '.' || repository === '..' ||
      !SEGMENT.test(repository)) throw new Error('Enter a valid repository name.');
  namespace.push(repository);
  const owner = namespace[0];
  const providerPath = namespace.join('/');
  const metadataUrl = provider === 'github'
    ? 'https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repository)
    : '/api/repository/metadata?provider=' + provider + '&path=' + encodeURIComponent(providerPath);
  return { provider, namespace, owner, repository, metadataUrl,
    displayUrl: 'https://' + url.hostname.toLowerCase() + '/' + providerPath };
}

export function parseGitHubRepositoryUrl(value: string): GitHubRepository {
  const repository = parseRepositoryUrl(value);
  if (repository.provider !== 'github') throw new Error('This legacy helper accepts GitHub repositories only.');
  return repository;
}

function encodePath(branch: string): string {
  if (!branch || branch.length > 255 || /[\u0000-\u0020\u007f%\\?#]/.test(branch) ||
      branch.startsWith('/') || branch.endsWith('/') || branch.includes('//') ||
      branch.split('/').some(part => !SEGMENT.test(part) || part === '.' || part === '..')) {
    throw new Error('The remote repository returned an invalid default branch.');
  }
  return branch.split('/').map(encodeURIComponent).join('/');
}

export function getRepositoryArchiveUrl(repository: PublicRepository, defaultBranch: string,
  gitlabProjectId?: number): string {
  const ref = encodePath(defaultBranch);
  if (repository.provider === 'github') {
    return '/api/github/archive/' + encodeURIComponent(repository.owner) + '/' +
      encodeURIComponent(repository.repository) + '/' + ref;
  }
  if (repository.provider === 'gitlab') {
    if (!Number.isSafeInteger(gitlabProjectId) || gitlabProjectId! < 1) {
      throw new Error('GitLab project metadata did not provide a valid project ID.');
    }
    return '/api/gitlab/archive/' + gitlabProjectId + '?sha=' + encodeURIComponent(defaultBranch);
  }
  return '/api/codeberg/archive/' + encodeURIComponent(repository.owner) + '/' +
    encodeURIComponent(repository.repository) + '/' + ref + '.zip';
}

export function getGitHubArchiveUrl(repository: GitHubRepository, branch: string): string {
  if (repository.provider !== 'github') throw new Error('Expected GitHub repository.');
  return getRepositoryArchiveUrl(repository, branch);
}
