# Phase 5 — Unified Intelligence V1 experimental vertical slice

**Status:** Experimental Node CLI plus read-only browser report integration. Not production, not default-main, no score changes.
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
- The original UCE scoring, issue records and native analyzer remain unchanged. The browser report now includes an experimental Root Causes section, but it does **not** retain source bytes or create an actual patch. A user must explicitly provide a local source evidence JSON and request a CLI input; only the Node-only propose command can validate the modeled graph and produce a guarded diff.
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
- UCE / Trilogy / Both origin labels. Both requires exact domain/title/file/evidence/**severity** equality with a single unambiguous UCE candidate. Conflicting-severity, multiple-candidate or merely similar findings stay separate. The original UCE issue records and their original severity are preserved.
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

## Phase 5.2 browser provenance and preservation refinement (2026-10-23)

- The UCE report remains the canonical source of scores and original issues. Root Causes now exposes a separately reviewable list of **all raw original UCE issue records** (ID, title, severity, file, reason) without changing scoring or the existing Issues tab.
- The derived workspace finding view is bounded to 1000 native entries. Its omitted count is explicit rather than silently implying full coverage; the raw original issue list remains accessible.
- Every finding displays **severity**, **origin** (UCE, Trilogy or Both), **evidence status** (report reference, extracted metadata, report-only), **formal verification** (not run), **potential impact hypothesis** and any original record references as independent dimensions. No calibrated confidence, observed runtime result or formal proof is implied.
- UCE findings with a valid saved source path and line use a navigable `path#Lline` report reference, not reconstructed or fetched file contents.
- Ungrouped findings can be expanded beyond the initial first 100; no ungrouped findings are omitted without an explicit display choice.
- Browser fusion now fails closed on ambiguous same-evidence UCE candidates and severity disagreement. Both `dependency` and `dependencies` module labels map to the dependency domain.
- Existing explicit developer-request-only proposal preparation, user-selected exact Node target, SHA-256 guard, read-only local CLI and prohibition on auto-apply remain unchanged.

Additional regression tests cover severity-conflict abstention, ambiguous native matching, source-line provenance, raw issue preservation and disclosed UI finding caps. **These changes are committed to experimental PR #86 but require successful exact-HEAD CI; do not treat a prior green milestone as proof for this head.** Production release is still NO-GO pending #77, #80, #81 and owner authorization.

## Phase 5.3 developer-reviewed browser request preparation (experimental)

This is a **request-preparation** UX increment, not browser-native patch generation.

- A local evidence JSON can contain root `package.json`, `package-lock.json`, exactly one literal `.nvmrc` or `.node-version`, and the bounded set of relevant evidence files. Unexpected top-level fields, including any pre-existing embedded `request`, are rejected. File contents remain untrusted data; per-file metadata is dropped from the newly exported request.
- Source reads and SHA-256 request construction use separate revision guards. Loading a different file, clearing evidence, or changing the developer-selected target invalidates unfinished or previously prepared requests. Generated input is never silently reused after source/target changes.
- Generate is enabled only for loaded local evidence and a nonempty developer-selected target. It prepares a source-hashed CLI *request* only on explicit click. It does not execute the project, install dependencies, contact a service, run a solver, create a diff, or apply any changes.
- The review panel displays the exact pin path, current version, target version and SHA-256, with visible risk factors and a manual verification checklist. To download the source-containing CLI input the developer must additionally acknowledge the evidence confidentiality and incomplete-verification risks.
- **No browser "fix verified" status:** the browser has not evaluated all graph semantics. The separate Node `propose` command can return `blocked`, `stale` or a read-only `proposed` diff; even `proposed` is not build/install/runtime proof. The actual checked-out project file must still be inspected before any manual change.
- Regression tests cover strict evidence sanitization, rejected stale embedded requests, risk metadata, SHA-256 identity, no generated diff, original-score parity and existing Phase 5 unsupported-case abstention. Exact-head CI and browser interaction QA are separate acceptance gates.

This experimental Phase 5.3 increment leaves all original UCE scoring, issue records and solver behavior unchanged. Keep PR #86 Draft; no merge, deployment, or general patch category expansion is authorized.

## Phase 5.4 first independent Node declaration discovery (experimental)

- For an eligible, complete and bounded mandatory npm graph, the local Node scan additionally inspects **both** canonical root .nvmrc and .node-version literal Node versions. If they differ, emit one source-backed Trilogy runtime **review** finding with both source paths and declared versions.
- This uses independently supplied local source bytes, not browser-derived UCE metadata. It does not prove which pin is active, application incompatibility, causal failure, install/build outcome or runtime behavior. Formal solver verification remains **not-run**.
- Reject nonliteral aliases, prereleases, noncanonical pin syntax and unsupported/partial graph cases rather than inventing a conflict. Input order cannot change the finding identity.
- Multiple pins continue to block V1 single-file patch proposals, even when the versions match. Scan never generates or applies a patch.
- Local CLI finding fusion now requires one unambiguous UCE record and matching severity before labeling it Both. Differing severity and duplicate native candidates preserve distinct original records.
- Added positive/negative Node pin evidence, Unknown abstention, original-score parity, nonmutation, deterministic identity and deduplication regression tests.

Acceptance remains contingent on all three successful exact-current-HEAD CI workflows and independent review. Do not merge into production main; release blockers #77, #80 and #81 remain.

## Phase 5.5 read-only Intelligence Quality & Safety evaluation foundation

An explicit third local experimental CLI action is available:

    node experiments/datalog-z3/phase5-cli.mjs evaluate /path/to/input.json

This executes the existing original UCE analyzer and Phase 5 read-only intelligence scan in memory, then runs a **structural audit** against both outputs. It is distinct from `propose`: no patch request or diff is emitted, and no project source files are modified or executed. No native Soufflé/Z3/cvc5 solver is invoked.

The audit output reports independent dimensions:

- Original UCE score and issue-count parity, plus per-issue ID, title, affected file and severity preservation checks.
- UCE-only, Trilogy-only, Both and context-only finding counts, and bounded provenance/reference diagnostics.
- Duplicate/ambiguous UCE IDs, missing original record links, severity drift, duplicate finding IDs, invalid source references and unsupported solver/proof status claims.
- Source-backed review candidates for later independent human adjudication, with bounded lists and explicit truncation counts.
- Distinct structural audit status and graph coverage status (`bounded-modeled-graph` versus `unknown`). A partial/unsupported graph is **not** treated as a clean compatibility result.

**Important quality boundary:** false-positive rate, false-merge rate, useful-new-finding rate, recommendation correctness and representative project accuracy remain `null` / `not-measured-needs-independent-labels`. Engineering structural parity and syntactic source references do not prove any of these quantities; original source bytes are not independently re-opened or rehashed by this evaluation. The owner has deferred independently blinded real-project accuracy adjudication to after product development (#80).

Implementation: `experiments/datalog-z3/phase5-evaluation.mjs` and `test/phase5-evaluation.test.mjs`. The native experimental package test command uses the `test/*.test.mjs` glob, so this suite is automatically included. No browser presentation, default UCE scoring, original issue records, symbolic semantics, automatic fix creation, patch application or production flag has changed.

Acceptance of this new Phase 5.5 increment requires new exact-HEAD CI passes, output contract inspection, and any appropriate independent review. PR #86 stays Draft, experimental, unmerged and production NO-GO; #77, #80 and #81 remain open.
