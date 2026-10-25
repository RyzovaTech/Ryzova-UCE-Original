# Phase 5.6A/B/C — Production Stabilization QA

**Scope:** verification and evidence only; no UCE scoring code, native Trilogy, developer auto-patching, environment flags, or production configuration changes.

## 5.6A — Live production smoke

- Verify Vercel production deployment's commit separately; this automated browser test only proves an end-to-end public demo UI behavior, not provenance of remote asset bytes.
- Test \`https://uce.ryzova.com/analyze?demo=1\` in Chromium on a GitHub-hosted runner. Scan only UCE's built-in public demo; follow the report route; open Root Causes; inspect quality, native score/issue parity, original issue records, review queue and developer-only proposal control.
- No private project source, keys, uploads, solver execution, or patch apply.
- This check depends on the **live public service**; network/DNS outages are reported as blockers, not mistaken for product correctness failures.

## 5.6B — Real project observational evaluation

Two separate evidence scopes:

1. Eight *curated pinned manifest excerpts* already checked into the repository with public GitHub source links, commit identifiers, and SHA-256s. Run actual UCE analyzer and read-only Phase 5.5 browser enrichment in memory. Always declare **partial/Unknown** coverage.
2. Two *historically pinned complete checked-out worktrees*, \`pallets/click\` and \`typicode/lowdb\`. Git fetch exact SHAs, never install or execute cloned code, scan at a maximum of **4,000 files / 16 MiB** via UCE trusted CLI, compare structural parity, and delete cloned source and detailed reports before uploading metadata.

Artifact output includes only repo/commit IDs, score/issue counts, grouping counts, structural flags, and truncation/coverage. No upstream source content is retained. **No blinded human review performed:** false-positive, false-merge, recall, precision, causal correctness, and recommendation correctness **remain null** and must not be promoted into an accuracy claim. Existing native Trilogy gates #77/#80/#81 are unchanged.

## 5.6C — Cross-browser accessibility/reflow

The existing Playwright matrix is extended to:
- full Unified Intelligence region axe-core WCAG 2.0/2.1 A/AA, not only its Quality subsection;
- responsive reflow without document-wide horizontal overflow at 390px and 320px;
- keyboard/focus, Enter/Space activation and reduced-motion view in Chromium, Firefox and WebKit.

**Still manual and pending:** actual NVDA/VoiceOver reading order and announcements, keyboard-only user journey, 200%/400% zoom in real browsers, real-device mobile scroll/touch/contrast checks and developer usability review. Passing axe checks alone is not a WCAG compliance certification.

## Release acceptance

This PR is a non-production QA increment. Confirm exact-head Full UCE CI, pinned excerpts, bounded public worktrees, live demo smoke, and three-browser tests. Keep PR draft until passing and reviewed. Never automatically enable native Trilogy or alter the deployed app based solely on measured structural parity.
