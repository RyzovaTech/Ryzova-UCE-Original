# Phase 5 — MCP, ChatGPT Plugin, and Public Git Repository Providers

Status: staged integration on PR #92. **Not merged, published, installed into ChatGPT, or deployed.**

## Scope and provenance
- Port the existing tested agent-first MCP tool implementation from draft PR #89 at `8d62db9`, including trusted checkout scans, SHA-pinned source provenance, paginated findings, deterministic report comparison, local stdio and protected development HTTP gateway.
- Port the ChatGPT/Codex plugin package from draft PR #91 at `92a1270` (stacked on #89), including its root-authorized launcher, repository analysis skill and plugin packaging tests.
- Port the public GitLab/Codeberg website providers from draft PR #90 at `f8a108e` including allowlisted metadata/archive relays, web UX, provider contracts and browser E2E. GitHub compatibility remains supported.
- Combine additions to `package.json`, `useAnalyzer.ts`, `analysis.worker.ts` and `types.ts` without dropping Phase 1 rule error reporting, Phase 2 mobile fixes, Phase 3 original-finding provenance or Phase 4 cache/worker execution safeguards.

## Agent-first behavior and boundaries
UCE MCP is an agent-accessible, local-source or Git-repository analysis service; chat attachments or ZIP uploads are optional alternatives, **not an artificial limit on the UCE engine**. Its resource policies serve machine safety and do not implement a paywall. MCP protocol results do not replace canonical compatibility findings, and report evidence does not prove runtime correctness.

The website providers use strict host allowlists for public GitHub/GitLab/Codeberg URLs and bounded repository-archive processing. There is no automatic privilege grant for private Git repos; a private source requires explicit user authorization. External Git URLs and untrusted project code must not be treated as trusted commands.

## Required acceptance
- Full original UCE CI (including Phase 1–4 integrity tests, rule/symbolic/accuracy/benchmarks) passes on the exact combined commit.
- MCP end-to-end CI and auth/tenant/security tests; Plugin launcher/manifest tests; GitLab/Codeberg provider contract and original browser UX tests all pass against the combined commit.
- Phase 2 real Chromium, Firefox and WebKit E2E remain green.
- Inspect security isolation, host-level disk/CPU/process controls, repository URL/network restrictions, private access/OAuth and transport compatibility.
- Real authenticated ChatGPT/Claude connector invocation, live public GitLab + Codeberg archive smoke and Windows Secure MCP Tunnel verification are **separate external acceptance gates**. Passing GitHub CI does not assert these are completed.
- Owner-authorized final review across all phases and manual accessibility/device testing precede *any* merge to `main` or production release. No manual Vercel deployment for this phase. GitHub integration might still trigger previews automatically.

## Overlapping draft PRs
PR #89, #90 and #91 remain draft and separate. PR #91 is stacked on #89. Do not merge these independently on top of combined PR #92 without a reconciliation review; doing so could duplicate files or discard reliability changes. This branch is the phase integration review target.
