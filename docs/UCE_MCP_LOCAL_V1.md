# RYZOVA UCE Local MCP Server — V1 (experimental, read-only)

This is a local **stdio Model Context Protocol** adapter around UCE's existing
trusted analyzer. It is not a remotely hosted MCP endpoint and is not related
to Trilogy's native Soufflé/Z3/cvc5 execution. It has no network listener.

## Prerequisites / explicit local authorization

Run `npm ci` at the verified UCE source checkout. Use `npm run mcp:local -- --root=/ABSOLUTE/AUTHORIZED/PROJECTS` to start the stdio server directly, or configure an MCP client as shown below. For MCP clients that
support local command-based stdio servers:

```json
{
  "mcpServers": {
    "ryzova-uce": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/Ryzova-UCE-Original/tools/mcp/server.mjs",
        "--root=/ABSOLUTE/PATH/TO/PROJECTS-YOU-AUTHORIZE"
      ]
    }
  }
}
```

Only set the authorized root to project folders you intend the MCP host to
read. The model can request reading **any non-symlink project path beneath
that root**, so do NOT aim it at your home directory, system root or a folder
with secrets. No UCE project source is uploaded by this server; the MCP
client can still receive analysis summaries, and its own policies apply.

### Available tools

- `uce_scan_project` with `{"projectPath":"subfolder","maxIssues":12}`: uses
  `scripts/uce-scan.mjs` from the trusted checkout, with 4,000 files /
  16 MiB source budget, 60s direct subprocess timeout, temporary report
  deleted, 8 MiB report cap. Returns bounded original UCE results, root
  clusters, quality/coverage status, and marked unmeasured accuracy.
- `uce_inspect_report` with `{"reportPath":"saved-report.json"}`: reviews an
  existing UCE JSON file of up to 8 MiB beneath the authorized root, without
  invoking the scanner or any native tools.
- `uce_capabilities`: safe mode, limits, provenance and known restrictions.

MCP negotiation supports protocol revisions `2025-06-18` and `2024-11-05`.
Server stdout is JSON-RPC-only; inbound requests are capped at 64 KiB.
Tool responses include JSON text plus structuredContent. No project scripts,
package install, native solver, patch application or server-side source upload.

## Security / release boundaries

Path containment and symlink checks are software-level protections; there
is no OS sandbox, filesystem race isolation, hard RSS/memory cap, remote
multi-tenant authentication or credentials management. **Run this local
adapter only for trusted, explicitly selected folders.** Do not advertise
it as a public HTTP MCP service or secure multi-tenant SaaS endpoint.

A tool response containing `satisfiable` or `conflict` comes from
the saved bounded original UCE reasoner, not independent SMT verification.
Browser-origin Root Cause associations are hypotheses, not proven
causality. Accuracy remains unmeasured until blinded human adjudication.

### Development QA

```bash
node --test testing/mcp/stdio.test.mjs
npm run test:report-regressions
```

Do not enable an HTTP transport, remote agent credentials, arbitrary
commands, write operations or native Trilogy in V1. If later required,
design authentication, user consent, tenant isolation, process-tree resource
budgets, rate limits and external security review first.
