# Linux kernel report audit (2026-09-28)

Input: user-provided UCE JSON and SARIF for `torvalds/linux`, report `rpt_muko1q2v_vgpddq` (UCE v3.0.0-beta.1). This is an audit of a single partial scan, not an accuracy measurement for the full kernel or other repositories. The uploaded report itself is an immutable record of the pre-fix scan; users must scan again to see corrected output.

The report correctly identified C as the primary language, Kbuild as the primary build system, and the operating-system-kernel architecture. It discovered 96,045 files, analyzed 25,000 (26% coverage), and read about 96 MiB of source content. Neither a compatibility score of 95 nor an absence of findings can establish safety for the unexamined content. The 54-second scan duration excludes any repository transfer time.

Verified issues and changes:

- `SEC038` at `mm/userfaultfd.c:3811` matched the `tls` suffix of `basic_ioctls = false`. Require complete `ssl` or `tls` identifiers; keep a positive test for `tls = false`.
- Seven `SEC005` matches were native-source URL literals, including a support URL in `drivers/leds/leds-clevo-mail.c:187`. A C URL without a nearby request call is not evidence of insecure network traffic. Native-source matches now need a nearby recognizable outbound network call; this does not prove network safety or cover every native client API.
- `SEC039` and `OS001` at `tools/virtio/vringh_test.c:149` reported a fixed `/tmp` path in a test utility. Native `_test.c` and `test_*.c` paths are now classified as tests. Platform portability advice for a Linux kernel build is suppressed.
- REST endpoint evidence from C files was falsely labeled `Rails/Phoenix` (for example `get "/enable"`). Route syntax is now restricted to its source language.
- Generic `.env.example`, CI, changelog, CONTRIBUTING, and SECURITY.md reminders are poor evidence for a kernel project with its own documentation and workflows. Application-only templates are inapplicable to a detected kernel. Ancillary Python build environment variables are no longer presented as missing application `.env` entries in this context.
- The report said `sampled: false` despite the 25,000-file ZIP selection. Preparation now retains upstream sampling metadata. Ignored-category names use the project-relative directory, not the ZIP wrapper.
- An insight claimed no testing capability although the same report counted 140 test files. Correlated insights now consult test-file evidence before making that claim.

Limitations: no full Linux ZIP or repeat end-to-end browser scan was available for this audit. Static rules and source-line comparisons informed the regression tests; they do not establish full-project accuracy. The number of findings and the overall score will change after a fresh scan, and coverage is still limited by the configured browser budgets.

## Phase 1 accuracy follow-up

The V3 inventory in the supplied scan recorded 236 findings, including 231 from the security module. Of these, 187 were calls to common native APIs such as `memcpy`, `free`, `malloc`, `memmove`, `sprintf`, `sscanf`, `strcpy`, `calloc` and `realloc`. A call by itself does not establish unsafe bounds or data flow; generic API presence is now informational while explicitly unsafe APIs remain review signals. The SQL assembly rule requires recognizable SQL statement syntax rather than matching isolated action words in unrelated code. Native fortify test sources are classified as tests.

The supplied report also labeled 82 V3 rule evaluations as truncated. Previously each rule counted unrelated file types against its file budget before checking its own file globs. Evaluations now count relevant candidates and retain a truncation label when a rule actually reaches a file, byte, time or match budget. These corrections may change both rule findings and elapsed time on a new scan; no post-change count or accuracy percentage is inferred from the old report.

For incomplete scans the Overview now displays selected-file coverage and says that the numeric score covers the checked scope. Markdown, shareable summaries, report lists and SARIF include compatible scope metadata. Selected files can have metadata without readable content. The 25,000-file and 96 MiB browser budgets are unchanged; exhaustive processing belongs to the next phase.
