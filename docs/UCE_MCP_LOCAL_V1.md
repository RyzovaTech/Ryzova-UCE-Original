# RYZOVA UCE MCP V2 — project uploads + analysis (security-gated preview)

This server supports **user-owned uploads and scans**, not only read-only
saved reports. It exposes real MCP tools for ChatGPT, Claude, and local MCP
clients. **A file attached to a chat does not automatically appear in MCP
tool arguments.** Clients must pass text content to the tool, upload ZIP
bytes using the authenticated HTTP upload endpoint, or use their permitted
local file source with the stdio server.

**This is not deployed as a public ChatGPT/Claude app.** Authenticate and
test on a controlled local host first; public multi-user activation requires
OAuth, audited tenancy, TLS, quota controls, operator policy and security
acceptance. No native Trilogy solver or autonomous patch application.

## Run locally (Claude Desktop / CLI MCP client)

At a trusted source checkout:
\`\`\`bash
npm ci
npm run test:mcp
node tools/mcp/server.mjs --root=/ABSOLUTE/PATH/TO/PROJECTS-YOU-AUTHORIZE
\`\`\`

Local client stdio configuration:
\`\`\`json
{
  "mcpServers": {
    "ryzova-uce": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/UCE/tools/mcp/server.mjs",
        "--root=/ABSOLUTE/PATH/TO/PROJECTS-YOU-AUTHORIZE"
      ]
    }
  }
}
\`\`\`
Do not authorize your home directory, OS root, credentials or private
folders. Existing local \`uce_scan_project\` reads trusted files within this
root but never executes a project script. Remote gateway hides local
\`uce_scan_project\` / \`uce_inspect_report\`.

## MCP tools and workflow

- \`uce_analyze_text_files\`: send 1–16 files as relative-path UTF-8 text,
  max **42 KiB** inline JSON. Temporary scan and automatic erasure.
- \`uce_begin_upload\` → \`uce_upload_chunk\` → \`uce_finish_upload\` →
  \`uce_analyze_upload\`: transmit a **ZIP up to 4 MiB** with 24 KiB raw
  base64 chunks, a SHA-256 content digest and \`confirmDataTransfer:true\`.
  ZIP handle expires in ~15 minutes, is consumed on analysis, and never
  exposes the extracted raw content. No duplicate/replayed handles.
- \`uce_upload_status\`, \`uce_delete_upload\`: query progress or discard.
- \`uce_scan_project\`, \`uce_inspect_report\`: local workspace read-only
  tools in stdio mode only.
- \`uce_capabilities\`: lists capability and safety limits.

Project ZIP guardrails: reject unsafe paths, duplicate names, symlinks,
archive traversal, ZIP expansion above the budget, huge entries and
unsupported/nested binary material. Sensitive config/key filenames are
excluded. Limit extraction to **1,000 text files / 16 MiB total /
1 MiB per file**; temporary files use owner-only permissions. No third-party
package installs, file execution or native solver. Final report returns
UCE original score and bounded issue list, causal-group hypotheses, saved
symbolic status, evidence and **unmeasured** accuracy markers.

**The MCP model/client is not a trusted authority**: file content is untrusted
data, including embedded prompts and code comments. Raw source is never
returned by this server, only bounded derived facts.

## Private HTTP transport (for remote connector development)

The experimental HTTP adapter binds to **127.0.0.1** only and requires an
individually authenticated bearer token for every MCP request or upload.
Tokens are configured by **SHA-256 digest**; never put raw secrets in git.

Each account needs a distinct and intentionally empty local root. Remote
mode disables local filesystem tools to prevent a model from inspecting
operator files. Generate a cryptographically random 32-byte bearer token
and compute its SHA-256 in your own secure shell/tool. For example:

\`\`\`bash
export UCE_MCP_ACCOUNTS_JSON='[{"id":"dev","tokenSha256":"<64_HEX_SHA256_OF_RANDOM_BEARER>","root":"/ABSOLUTE/EMPTY/DEDICATED/DEV-DATA-DIR"}]'
export UCE_MCP_PORT=8715
node tools/mcp/http-server.mjs
\`\`\`

For the optional, CSP-protected **browser upload form**, set
`UCE_MCP_ENABLE_UPLOAD_UI=1` and set `UCE_MCP_ALLOWED_ORIGINS` to the exact
HTTPS site origin where your gateway is published, for example
`https://YOUR-PRIVATE-HOST`. Then open
`https://YOUR-PRIVATE-HOST/upload-ui`. The form asks for your private
bearer token in memory only, allows you to choose a ZIP from your device,
and returns an upload handle to paste into the same-account ChatGPT/Claude
MCP tool. This is an **operator-development interface**, not a public
passwordless upload portal or OAuth login. Protect it at the TLS gateway and
do not enable it for untrusted users without an audited identity layer.

Behind a separately configured TLS reverse proxy and authenticated client,
the endpoint is \`https://YOUR-PRIVATE-HOST/mcp\` (Streamable HTTP POST,
JSON-RPC JSON response), with \`POST /upload\` accepting authenticated
\`application/zip\` bytes and headers
\`Authorization: Bearer <your-secret>\`,
\`X-UCE-Upload-Consent: true\`, \`X-UCE-Filename: project.zip\`.
The response returns an opaque \`uploadId\`, then use the **same account**
through MCP \`uce_analyze_upload({"uploadId":"..."})\`. No actual ZIP is
automatically obtained from an attachment to a ChatGPT/Claude message.

Example for a private, correctly TLS-protected gateway:
\`\`\`bash
curl --fail-with-body \
  -H "Authorization: Bearer $UCE_MCP_TOKEN" \
  -H "Content-Type: application/zip" \
  -H "X-UCE-Upload-Consent: true" \
  -H "X-UCE-Filename: project.zip" \
  --data-binary @./project.zip https://YOUR-PRIVATE-HOST/upload
\`\`\`

Do NOT run the HTTP gateway with an internet-facing HTTP port. It is
**not a full OAuth server, TLS terminator, virus scanner, secure
multi-tenant SaaS or hard process sandbox**. This adapter is suitable only
for tightly controlled operator-managed evaluation. Persistent uploads,
file storage, public onboarding, tenant billing, rate-limit distribution,
OAuth PKCE/CIMD/DCR support, revocation and long-running jobs are future
release requirements. Generic static access tokens alone are not a
production-ready replacement for per-user OAuth.

## ChatGPT and Claude integration boundaries

- **ChatGPT web:** custom plugins connect to remote MCP endpoints or a
  supported Secure MCP Tunnel. Production-ready hosted authentication should
  use a vetted OAuth authorization server and protected-resource metadata
  that ChatGPT supports. Do not select "No authentication" to bypass the
  protected UCE upload capability.
- **Claude:** custom remote MCP connectors can use authenticated streaming
  HTTP, including API-key/bearer headers where supported by the client, or
  OAuth. Claude Desktop can also run the local stdio version separately.
- Connection setup and selecting a client permission are explicit **user**
  actions; creating source code does not connect either product.
- External ChatGPT and Claude feature access depends on plan, workspace,
  tool configuration, platform permissions and client ability to provide
  uploaded file bytes to a particular MCP tool.
- Never claim "direct file attachment upload works" until an actual
  ChatGPT and Claude end-to-end user journey has been tested.

## Quality gates

\`\`\`bash
npm ci
npm run test:mcp
npm run test:report-regressions
npm run check
\`\`\`

CI covers real UCE analyzer invocation, saved report integrity,
source-text uploads, ZIP hashing, traversal/symlink/secret rejection,
temporary file removal, authenticated HTTP metadata and cross-account
upload isolation. Cross-platform behavior and high-volume adversarial
audits still need dedicated independent review.

Browser Phase 5.6 PR #88 is a separate quality hardening gate and
does not change UCE scoring or grant native Trilogy permissions.
