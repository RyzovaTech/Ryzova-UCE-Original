# Ryzova UCE plugin — packaging preview

This package bundles a **ChatGPT/Codex plugin manifest**, a reusable
repository-analysis skill and an optional **local** MCP entrypoint. It is
not yet a published or installed ChatGPT plugin.

## Local development (checkout containing PR #89)

Run `npm ci` from the UCE repository root. Explicitly authorize only
the project directory you want to analyze:

```sh
export UCE_MCP_AUTHORIZED_ROOT="/absolute/path/to/allowed/projects"
node plugins/uce/bin/launch.mjs
```

`plugins/uce/.mcp.json` provides a bundled MCP server command for
developer tooling that resolves commands from the UCE repository root.
Do not authorize your home directory or sensitive folders.

## ChatGPT / Claude remote testing

Register an HTTPS Streamable HTTP MCP endpoint using the ChatGPT plugin
developer-mode UI (Settings > Security and login > Developer mode,
then Plugins > +). Claude may use the same remote endpoint through its
supported connector flow. **The repository contains a private loopback
HTTP development gateway, not a hosted endpoint**.

1. Deploy a separately reviewed HTTPS service backed by the PR #89 MCP
   implementation. Use an externally configured OAuth identity provider
   with per-user scopes, audience and subject isolation.
2. Register the endpoint in ChatGPT. Copy the assigned
   `plugin_asdk_app...` technical ID.
3. Only after a real plugin connection exists, create an `.app.json`
   mapping to that exact ID and add `"apps":"./.app.json"` to the
   manifest. Do not invent an app ID or put secrets in the package.
4. Test `initialize`, `tools/list`, a pinned public Git scan,
   asynchronous polling, rule summary, every-page findings and
   repeatable comparison from both ChatGPT and Claude.

The public site `uce.ryzova.com` and original GitLab/Codeberg import
PR #90 are independent of this plugin package.

## Release blockers

PR #89 MCP CI passed but its Full UCE CI self-scan reported 82 warnings
and a failed threshold; this must be adjudicated, never muted to claim
success. Additionally perform real OAuth login, tenancy, resource
isolation, remote ChatGPT/Claude end-to-end checks and publication review
before describing the plugin as live. No code changes to production
`main` are made by this packaging branch.

No UCE paywall, premium rule tier or artificial chat-file restriction.
Large remote scans use the repository-first asynchronous MCP tools.
