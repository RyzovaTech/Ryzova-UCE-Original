# Original UCE: Public GitHub, GitLab and Codeberg Repository Import

This is the original UCE Analyze Project browser application, not MCP.

> **Current browser UI (2026-10-27):** Only GitHub and Codeberg public
> repository URL import is shown. GitLab URL import is temporarily hidden
> because real GitLab public ZIP archive requests returned HTTP 406.
> The GitLab parser, metadata and archive relay code remains in place for
> future repair, but the browser UI rejects pasted GitLab URLs without a
> network request. Use GitLab's manual ZIP download plus **ZIP Upload**.
> See [live failure #103](https://github.com/RyzovaTech/Ryzova-UCE-Original/issues/103).
>
> The three-provider architecture below describes existing implementation,
> **not** current three-provider live support or accuracy certification.


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
