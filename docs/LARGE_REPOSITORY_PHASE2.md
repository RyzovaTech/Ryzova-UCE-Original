# Large repository scanning: Phase 2 foundation

This milestone adapts the streaming and backpressure approach used by Ryzova E-Pen to UCE's local analysis pipeline. E-Pen's encrypted WebRTC transfer protocol is not used: a scanner needs bounded extraction and CPU work, not a peer-to-peer transport.

## Current data path

1. GitHub's public archive relay sends a stream to the browser. UCE waits for each write before reading the next chunk. Beyond 64 MiB, a supported browser spools the compressed download to private origin storage (OPFS) and removes the temporary archive after analysis, failure, or cancellation. Browsers without OPFS continue on the bounded Blob path.
2. A single dedicated worker opens the archive, chooses source and manifest files, prepares the bounded input, and runs the analyzer. Source text no longer travels from the UI thread to an analysis worker. The UI receives progress, project preview, cache key, and final report only. Terminating the worker cancels extraction as well as analysis.
3. Scan statistics separate discovered file names, selected files, and selected files whose text was actually read. A partial scan still limits the score to checked content; an archive with 100% indexed names has not necessarily had all its source analyzed.
4. The V3 executor builds a per-scan candidate index, caching up to 96 shared scope/path selections. Repeated rules can reuse eligible file lists; the index is discarded when the scan ends. Rule findings and per-rule budgets remain unchanged.

## Remaining boundaries

- JSZip still loads and indexes a compressed archive in the worker. OPFS lowers download buffering on the main thread but does not remove the archive decoder's memory cost.
- Browser selection remains capped at 25,000 files, 96 MiB of selected text, and 2 MiB per text file. Rule budgets can limit individual detectors further. The previous Linux report's 26% selected-file coverage is not turned into a 100% scan by this change.
- The 2 GiB compressed archive limit is a ceiling, not a guarantee that every device can decode a 2 GiB ZIP. Large projects may still require the CLI.
- OPFS cleanup covers normal completion, handled failures, and cancellation. An abrupt browser crash can leave a temporary archive in origin storage until the browser clears site data; it is not an encrypted checkpoint.
- Resume after cancelling a local ZIP starts extraction again; it does not resume in the middle of the archive. Temporary OPFS archives are discarded rather than preserved as checkpoints.

The optional `UCE_BENCH_SOURCE_FILES=25000 npm run benchmark:v3-memory` (or `50000`) measures the V3-only candidate scan over small synthetic C files with a 512 MiB Node heap. It does not measure ZIP decompression, all UCE intelligence modules, browser peak memory, or real Linux rule coverage; the browser budget is unchanged until those end-to-end tests pass.

## Next scalability steps

Move ZIP indexing to a seekable/streaming reader with ZIP64 and integrity validation, then partition relevant source files into bounded batches. Run file-local detectors incrementally while preserving project-level manifest and cross-file evidence. Checkpoint batches by archive fingerprint and rule-pack version; validate changed files and resume without retaining entire source trees. Benchmark representative Linux, monorepo, generated/vendor-heavy, ZIP-bomb, mobile-browser, and low-memory fixtures before offering a full-browser scan mode. Keep separate percentages for indexed names, content read, rules evaluated, and detected findings.
