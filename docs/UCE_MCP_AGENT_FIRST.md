# UCE MCP — AI-native compatibility and rule testing (open source)

**Mission:** let ChatGPT, Claude and other MCP clients use **UCE as a repeatable
rule-based compatibility evaluation engine** for real software projects.
UCE uses the project's original analyzer: technology detection, compatibility,
dependency/manifest evidence, V3 rule packs, security contextual diagnostics,
bounded symbolic reasoning, reviewable recommendations, and an honest Unknown
state. It does not substitute model guesses for original UCE rule results.

UCE source: **MPL-2.0**. No UCE subscription, billing gate, premium rules
tier or per-repository payment requirement exists in this MCP implementation.
Third-party AI provider plan/tool access and operator compute/hosting costs
are separate from UCE's open-source license.

## Preferred agent journey — NO CHAT ATTACHMENT OR ZIP REQUIRED

Example in ChatGPT or Claude after connecting a running UCE MCP server:

> Analyze `https://github.com/pallets/click` using UCE, identify compatibility
> findings with file evidence and recommended fixes, show rules by module,
> and explicitly report incomplete coverage or unverified claims. Compare
> the new findings with a previous scan if available.

Model calls:

0. `uce_rule_catalog({mode:"packs"})` or
   `uce_rule_catalog({mode:"rules",module:"dependency",limit:100})` to
   discover the **actual registered UCE rule packs and detectors**.
   Catalog presence alone is not proof that a rule ran or matched.
1. `uce_scan_repository({repository:"pallets/click",ref:"<commit-sha>"})`
   or any public HTTPS GitHub, GitLab or Codeberg URL allowed by the server
   operator. `ref` is optional; specifying an exact **40-character commit**
   gives a reproducible source snapshot.
2. Response includes source repository, **resolved commit SHA**, UCE scanner
   version, original score, rule findings by module, source coverage,
   normalized SHA-256 rules fingerprint, and temporary `reportId`.
3. `uce_rule_summary({reportId})` for module-by-module compatibility
   evidence and original UCE structural score/issue parity.
4. `uce_get_findings({reportId,offset:0,limit:100})` repeatedly until
   `hasMore:false`. Page size limits chat output **not total UCE analysis**.
   The model can inspect all findings, not just the first N or a summary.
5. `uce_compare_reports({beforeReportId,afterReportId})` to see exact
   normalized rule fingerprint equality, score changes and module deltas
   between two commits/scans.
6. `uce_release_report({reportId})` to remove saved metadata immediately.
   Temporary fetched source code is deleted after the scan.

Also `uce_scan_workspace({projectPath:"your-local-folder"})` for a local,
explicitly authorized checkout. Local paths remain confined to the
operator/user-approved stdio root. **Private repositories** must be supplied
via an authorized checkout or another explicitly scoped permission source;
ChatGPT or Claude's own GitHub authorization is NOT automatically delegated
to UCE's Git process.

### Reproducibility

Every Git scan records the exact checked-out source SHA, scan coverage,
source-byte/file budgets and UCE rules version. Result IDs/timestamps are
not treated as deterministic. A separate fingerprint is computed from the
original UCE score and normalized canonical compatibility, V3, security and
extended rule findings, excluding random report IDs.

A repeated stable fingerprint means the **rule results** match; it is not
proof that findings are true, causal, exploitable or that the app will run.
Comparisons between sampled/truncated reports must be treated as limited.

## No arbitrary product quotas, still safe resource budgets

**No ZIP size or chat file-size limit applies to `uce_scan_repository`.**
The MCP agent gives UCE a repository URL; UCE fetches source directly.
The scanner's normal defaults are **25,000 files / 96 MiB source content**.
Agents may request higher values through `maxFiles` / `maxBytes`.
The operating environment can configure resource policies:

```bash
UCE_MCP_MAX_SCAN_FILES=400000
UCE_MCP_MAX_SCAN_BYTES=2147483648
```

These are machine-safety/resource bounds, not UCE licensing, paid tier,
model-message or attachment limits. If a scan reaches the budget, UCE
must flag partial coverage/Unknown rather than quietly claiming clean.
For large projects use a server with adequate RAM/disk and actual
process-tree isolation; #77 and #81 remain acceptance blockers for
production-scale hostile workloads.

**No AI service can bypass its own product's attachment/tool/token limits.**
Repo-first MCP eliminates the need to transfer a project through the
chat as an attachment. It does not override ChatGPT/Claude platform
rules or expose private GitHub repositories without consent.

## Optional ways to provide source

- Local `uce_scan_workspace`: trusted checkout, no ZIP.
- Connected AI MCP tooling can pass source text through
  `uce_analyze_text_files` when the client exposes bytes.
- Explicit ZIP transfer and optional private upload page are supported
  as **fallbacks** for projects without accessible Git URLs.
  The experimental 4 MiB ZIP transport staging budget is a limitation
  of that *fallback transport*, not a requirement or upper bound of UCE.
  For larger files prefer Git/local checkout rather than serializing
  huge content into model tokens.

## Rules and security are kept honest

UCE is not a general-purpose shell. It never installs or runs the
third-party project's dependencies/tests, Git hooks, LFS smudge commands,
submodules or arbitrary commands during scanning. Browser-only Trilogy
origin labels are NOT evidence of native Soufflé/Z3/cvc5 execution.
Automated compatibility rules and score remain original UCE outputs,
and the MCP interface cannot silently alter score, false-positive
statistics, raw findings, acceptance labels or ground truth.

The project does not have human-adjudicated global accuracy claims;
`falsePositiveRate`, `falseMergeRate` and other independently unmeasured
rates remain null. The MCP cannot make unverified claims more accurate.

## ChatGPT and Claude access

- **Claude Desktop/local MCP:** configure `node tools/mcp/server.mjs
  --root=/EXPLICIT/PROJECTS`, then use the tools listed above.
- **ChatGPT/Claude cloud:** connect a real HTTPS Streamable HTTP MCP
  server, or a supported secure tunnel where available, with permissions
  and identity/tenant isolation. Our private `http-server.mjs` is a
  development gateway that binds to loopback; **not a public deployment**.
- For multi-user remote usage, supply an external reviewed OAuth provider
  and enforce per-user source permissions; never expose a shared bearer
  token for everyone. Users explicitly connect the remote MCP client.
- Both AI products may impose their own account-level tool limits.
  **UCE itself has no product paywall.**

See [MCP V2 transport and identity guide](UCE_MCP_V2_UPLOADS.md) for optional
uploads, OAuth resource verification, private upload UI and exact setup.

## Engineering validation before merge

```bash
npm ci
npm run test:mcp
npm run test:report-regressions
npm run check
```

The MCP CI includes parsing malicious Git URLs, locally scanning an
actual fixture, paginating **all** real rule findings, repeat scan
fingerprint invariance and fetching an exact pinned public Git commit.
It also tests existing upload security, authentication, OAuth JWTs and
cross-user isolation. Exact-head CI must pass and a real ChatGPT/Claude
agent tool journey must be reviewed before release.

This branch remains **Draft and unmerged** until verification passes.
