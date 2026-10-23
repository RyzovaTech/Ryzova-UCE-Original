# Phase 5 — Unified Intelligence V1 experimental vertical slice

**Status:** Node-only experimental engineering. Not production, not browser, no score changes.
**Design:** Full Project Intelligence foundation, gradual capability rollout; Root Cause First UX, explicit UCE/Trilogy/Both origins and honest evidence boundaries.

## Current implemented slice (not the entire Phase 5 roadmap)

- Read-only UCE findings adapter preserving native UCE score and issues.
- Independent, source-backed static discovery of Node requirements and runtime pin mismatches from complete npm v2/v3 mandatory dependency graphs. Unsupported workspaces/peer/optional/platform semantics return Unknown, preserving UCE issues.
- Cross-engine equivalence additionally requires the identical source-linked Node pin and matching violated requirement value (not merely matching titles and files). Unproven equivalence preserves both findings separately. A Node runtime association group is not a proven causal explanation.
- Scan returns a source hash and on-demand proposal eligibility hints but **never generates a diff**.
- Explicit developer-requested read-only proposals for **one** literal .nvmrc OR .node-version pin. The developer supplies a stable Node x.y.z target version. Proposals are never auto-generated or applied.
- No native solver execution in this V1 static intelligence/patch code. All discovered facts remain NOT formally verified. Existing Souffle-Z3-cvc5 opt-in pipeline is unchanged.

## Local workflow

Prepare a local JSON input with fileName, optional workspace, and files as an array of records containing project-relative path and UTF-8 content. Schematic only (replace the omitted manifest/lockfile entries with valid JSON):

    {
      "fileName": "my-project",
      "workspace": "",
      "files": [
        {"path": "package.json", "content": "{\"name\":\"x\",...}"},
        {"path": "package-lock.json", "content": "{...}"},
        {"path": ".nvmrc", "content": "20.0.0\n"}
      ]
    }

Run the read-only scan:

    node experiments/datalog-z3/phase5-cli.mjs scan /path/to/input.json

To request a patch, first read the target file's SHA-256 from the scan response patchTargets and add this JSON object to the input:

    "request": {
      "action": "generate-fix-proposal",
      "targetFile": ".nvmrc",
      "expectedSha256": "<sha256 returned by scan>",
      "targetVersion": "22.0.0"
    }

Explicitly request the proposed diff:

    node experiments/datalog-z3/phase5-cli.mjs propose /path/to/input-with-request.json

Only source-backed complete graph semantics, a single supported pin file, matching SHA, unambiguous stable target and target satisfying ALL modeled Node requirements can produce a proposed diff. No file writes, npm install, native solver calls, project hooks or builds occur. The output includes minimal diff preview, before/after hashes, risks and developer validation steps.

**Important:** proposed means modeled Node constraints are statically compatible, NOT that the build/runtime is verified. Stale, unsupported or ambiguous inputs get blocked, stale or not-requested without a diff.

## Scope limitations / safeguards

- No CI YAML / GitHub Actions, package.json, package-lock.json, source code, framework, dependency upgrade or security-sensitive patching in V1.
- Scan and propose use bounded input and path checks. Any nonliteral runtime pin, path traversal, multiple pin files, conflicting target or unsupported lock semantics abstains.
- The original UCE scoring, issues, native analyzer and browser user interface remain unchanged. Stored browser reports may not retain source bytes, so they cannot safely generate a source-hash-checked patch yet.
- The original input files are unchanged; output provides an advisory diff only. There is no Apply button.
- Existing standalone formal verification (native Souffle, Z3, cvc5) is separate and opt-in, and is not represented as having run during static discovery.
- Independent human accuracy validation stays owner-deferred until after product work. Production release requires external hard-cgroup and performance gates.

## Follow-on increments

1. Additional source-backed independent discovery verticals and typed evidence schema.
2. More grounded UCE/Trilogy correlation and root cause associations, with false-merge audits.
3. Browser Root Cause First UI, provenance, limitations, and explicit Generate Fix Proposal control only when original scan source bytes can be safely accessed.
4. Conservative CI literal proposal cases after unambiguous YAML parsing and tests.
5. Prospective real-project coverage/accuracy review and delegated hard-memory validation (#77, #80, #81).

Tests:

    node --test experiments/datalog-z3/test/phase5-unified-intelligence.test.mjs
    npm --prefix experiments/datalog-z3 test

**No main merge, default enabling, automatic file modifications or production release.**


## Browser Root Cause First experimental UI (Phase 5 next slice)

A new "Root Causes" report section is the first view for software scans on the experimental branch. The existing Overview and Issues sections, original score and report exports remain available and unchanged.

- Read-only browser enrichment of original UCE findings and source-linked, UCE-extracted dependency risks and framework metadata. No source-code execution, new native solver invocation or project mutation.
- UCE / Trilogy / Both origin labels. Both requires exact domain/title/file/evidence equality; no title-only fuzzy deduplication. The original UCE issue records are preserved.
- Root Cause First groups are **investigation clusters**, based on shared module/domain evidence, NOT established causal roots. Ungrouped findings remain available.
- Dependency enrichment covers source-referenced wildcard, remote-source and version-conflict declaration risks. Framework enrichment is informational source context, **not** a confirmed incompatibility.
- Source reference clicks navigate to an Evidence Inspector showing linked report evidence and exact paths. Saved reports do NOT contain arbitrary original source bytes; the UI does not synthesize a source preview.
- **Generate Fix Proposal** is an explicitly clicked browser control requiring a developer-provided local JSON evidence bundle and an exact stable Node target. It prepares a SHA-256 guarded input for the existing Node-only CLI; it does NOT create a diff in the browser and does not modify files or call a native solver.
- The developer must explicitly download the reviewed input (contains source contents and must be kept private), then run the Node-only phase5-cli.mjs propose command locally to receive an actual bounded read-only diff preview.
- V1 patch preview supports one .nvmrc OR .node-version pin only. No GitHub Actions/YAML, package.json, package-lock.json, framework or application-source patches.
- Rejected/unknown graph semantics stay blocked; Phase 4 hard resource and owner post-product accuracy/release gates are still open.

Regression commands:

    npm run test:report-regressions
    npm run build
    npm --prefix experiments/datalog-z3 test

**No main merge, default production enablement or permission to auto-apply a proposed change.**
