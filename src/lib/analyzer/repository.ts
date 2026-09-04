export interface GitHubRepository {
  owner: string;
  repository: string;
  archiveUrl: string;
}

/**
 * Parse the two GitHub remote forms that can be downloaded safely in-browser.
 * Keeping this allowlisted avoids turning the analyzer into an arbitrary URL
 * fetcher while providing a clear base for additional Git hosts later.
 */
export function parseGitHubRepositoryUrl(value: string): GitHubRepository {
  const input = value.trim();
  const sshMatch = input.match(/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  const normalized = sshMatch ? `https://github.com/${sshMatch[1]}/${sshMatch[2]}` : input;

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error('Enter a GitHub repository URL or Git remote, for example https://github.com/owner/repository.');
  }

  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com') {
    throw new Error('Remote analysis currently supports public GitHub repositories only. Upload a ZIP for other Git hosts.');
  }
  if (url.search || url.hash) {
    throw new Error('Enter the repository root URL without a branch, file path, query, or fragment.');
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length !== 2 || !segments.every((segment) => /^[A-Za-z0-9_.-]+$/.test(segment))) {
    throw new Error('Enter the repository root URL, for example https://github.com/owner/repository.');
  }

  const [owner, rawRepository] = segments;
  const repository = rawRepository.replace(/\.git$/i, '');
  if (!repository) throw new Error('Enter a repository name after the GitHub owner.');

  return {
    owner,
    repository,
    archiveUrl: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/archive/HEAD.zip`,
  };
}
