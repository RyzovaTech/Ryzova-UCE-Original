# Trilogy T1 — Independent Evidence Reader & Fail-Closed Adjudication

**Status:** experimental Node-only read-only **source predicate** checking, stacked on T0 PR #93. Not a production scanner, vulnerability verifier or automatic patch generator.

## Problem and trust boundaries

The browser report's `UCE`, `Trilogy` and `Both` labels can represent correlations based on UCE-extracted metadata. They are not proof that an independent Trilogy detector validated source. T1 **does not** relabel browser `Both` or alter the original reports; its origin stays `UCE`, and its independent detector field is `not-run`.

T1 receives a canonical UCE report, an explicitly supplied local source-file snapshot, and optional *separately authored* typed literal-source assertions pinned to a SHA-256 snapshot digest. It checks evidence independently of the original rule detector by re-reading supplied source strings at the declared source line, **not** by trusting rule descriptions. The data source authentication and approval process must happen outside T1; it makes no network request or trust claim about where the bytes came from.

### Evidence states
| State | Meaning and limit |
| --- | --- |
| `unknown` | File missing/unreadable, invalid paths, ambiguous assertions, malformed predicate, stale hash or unavailable snapshot |
| `source-referenced` | Referenced source can be read, but the independent predicate is missing; also used on partial scans even if a local fragment matches |
| `independently-checked-in-scope` | A SHA-256-pinned **literal fragment** occurs at the exact specified line on a complete static scan. **This is proof only of text presence in supplied bytes**, not of the issue or application's correctness |
| `disputed` | A valid pinned literal-source assertion does not match the source at the declared line. This disputes the literal predicate, not necessarily the original issue |

No combination of statuses authorizes patch application, score increases, runtime correctness, verified vulnerabilities or an independent global accuracy claim. The result retains counts and hashed finding identities only, not raw source content/paths, to reduce accidental source disclosure. Distinct issue IDs remain distinct even when titles match.

### Fail-closed boundaries
- Max 5,000 files, 5,000 canonical issues, 5,000 assertions; total readable content 4 MiB and a single-file limit 256 KiB. Anything unreadable/over-budget is `unknown`; total budget violation fails explicitly.
- Reject traversal/ambiguous file inventories, duplicate issue IDs, invalid assertion IDs and unknown assertion types. Duplicate evidence assertions cannot promote a finding.
- For incomplete UCE scans, execution errors or V3 budget truncation, never promote to independently checked despite a matching local literal.
- Source hash mismatch is **Unknown**, not fabricated disagreement. A matched source-hash with absent fragment is narrowly **Disputed**.
- Sort hashed issue identifiers for deterministic output; no direct source strings, executable code or user-provided URLs are present in the emitted artifact.

### Reproduce

```sh
npm ci
node --test testing/trilogy-t0/*.test.mjs testing/trilogy-t1/*.test.mjs
node testing/trilogy-t0/run.mjs --output=trilogy-t0-report.json
node testing/trilogy-t1/run.mjs --output=trilogy-t1-report.json
```

T0 CI checks remain untouched except extension of the same dedicated isolated workflow. Existing full UCE CI and CodeQL continue as independent required gates. This branch does not enable Soufflé/Z3/cvc5, modify native UCE scoring/rules/alerts, expose MCP tools or trigger manual production deployment.

### Next T2
Build source-backed whole-project relationships with independent and authenticated graph facts, negative controls, cross-file completeness and precision/recall evaluation. Keep global accuracy metrics `null` until independent blinded human review (#80). Native process isolation (#77) and performance (#81) remain release blockers.
