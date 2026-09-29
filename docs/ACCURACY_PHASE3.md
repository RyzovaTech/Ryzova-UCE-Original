# Accuracy Phase 3: bounded rule execution beyond the core sample

The core cross-file analysis still selects at most 25,000 files and 96 MiB of
text. A ZIP batch scan now also routes **277 built-in standalone source regex
rules** and **7,002 built-in standalone dependency rules** through the readable archive. A
manifest encountered after the core sample can therefore contribute package
version findings; a late source file can contribute a V3 signature finding.
Rules with multiple detectors, config/AST adapters or cross-file correlations
remain in the core pass. This is not execution of all 10,000 rules on every file.

The sweep processes at most 128 entries / 8 MiB of text per batch, reuses the
existing manifest parser, dispatches dependency rules by ecosystem and package
name, and routes source rules by file extension and scope. No scanned code is
executed. It stores at most 300 additional findings, at most five per rule,
with an information-signal allowance of 100. The report counts omitted matches
when a cap is reached. The sweep continues checking readable files after the
display cap so coverage does not silently stop. Oversized/unreadable text is
still excluded and labeled; a rule-file visit is an evaluation, not proof that
the rule parsed or understood the file semantically.

Report coverage distinguishes inventory, text reading, core analysis, security,
browser, code and the new V3 per-file sweep. The sweep records actual files
checked, dependency manifests checked, rule-file visits, eligible/visited
rules, omitted findings and completion state. Partial overall readiness stays
unestablished while cross-file rules, content limits or finding caps apply.
When a small archive has complete input and no limit is reached, the temporary
in-progress inventory state clears and the report remains full.
The UI labels the aggregate counter **Rule Evaluations**, not a count of
unique rules.

Checkpoints now use version 2 and retain sweep progress, limits and findings
across resume. Analysis cache version 14 prevents older results from masking
the new pass. Old checkpoint versions are not resumed.

## Validation

The `npm run benchmark:zip-batches` fixture generates 96,000 small C files.
Its measured run checked all 96,000 with the standalone source rules, made
2,880,000 rule-file visits and finished within the 150-second / 512-MiB heap
benchmark gates. This is a synthetic measurement; the timing and memory use
of the real Linux archive will differ. Tests include a late native rule match,
a late dependency manifest, test-scope exclusion, duplicate suppression,
finding caps and checkpoint resume. A fresh Linux scan is needed to establish
its new coverage and issue counts.
An additional 40,000-file run with 1-KiB source files passed the same limits;
the fixture payload size can be selected with `UCE_BENCH_ZIP_PAYLOAD_BYTES`.

Phase 4 remains the semantic and cross-file analysis work: these signature
matches are review signals, and the limited core multi-detector passes cannot
prove absence of risk elsewhere in the repository.
