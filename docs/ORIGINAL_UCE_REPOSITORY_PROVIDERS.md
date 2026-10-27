# Original UCE: Public GitHub, GitLab and Codeberg Repository Import

This is the original UCE Analyze Project browser application, not MCP.

Supported public repository roots: https://github.com/owner/repo,
https://gitlab.com/group/repo,
https://gitlab.com/group/subgroup/repo and
https://codeberg.org/owner/repo, plus supported git@ SSH remote syntax.

The Git Repository tab obtains the default branch from the public host.
GitHub uses the existing GitHub API flow. GitLab and Codeberg use
GET /api/repository/metadata with a hardcoded upstream host allowlist.
GitLab nested namespace lookups resolve to numeric project IDs.
The original Vercel archive relay for GitHub is unchanged.
Additional fixed-target relays point only to GitLab and Codeberg ZIP
archive endpoints. The original browser archive parser and UCE analyzer
process the downloaded source locally, without executing project scripts.
Report source identity is preserved as github, gitlab or codeberg.

No arbitrary URLs, credentials, private repository access, custom host,
automatic patches or native Trilogy are enabled. Repository imports
retain the existing browser compressed archive safety limits and
transparent Unknown/sampling behavior. GitLab.com may rate-limit public
archive requests; provider network and CORS behavior requires real
deployed-browser smoke testing.

Run npm run test:repository-import, npm run check and npm run build.
Acceptance also requires real public GitLab and Codeberg repository
imports after deployment. Unit tests alone are not production proof.

This is separate from the UCE MCP work in draft PR #89.

## GitLab archive API 406 — bounded web ZIP fallback (2026-10-27)

A real user browser reported HTTP 406 from the GitLab API archive relay while
GitHub Express and Codeberg Pages Server generated UCE reports. This is an
archive transport failure, not a compatibility finding.

For **GitLab 406 only**, the original browser analyzer tries GitLab's
public web download ZIP route through a fixed `gitlab.com` rewrite.
This is **not** a retry for 401/403/404/429/5xx; it neither evades provider
rate limits nor uses credentials. A validated public GitLab repository root
and a single-segment default branch determine the fallback URL; slash refs
are intentionally not guessed. Existing streaming size limits, browser ZIP
validation, report source identity and original rules are retained.

This addition has mocked browser/route tests. **Live GitLab browser import
must pass before declaring the bug fixed.** Until then a user can download
ZIP from GitLab and use the site's ZIP Upload.
