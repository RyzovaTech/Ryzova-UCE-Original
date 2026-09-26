# Archive and dependency accuracy review

This regression review fixes specific reproducible errors; it does not establish an accuracy percentage across all repositories.

## Corrections

- Read bounded npm, Yarn and pnpm text lockfiles instead of silently discarding their contents. Oversized text remains metadata-only and marks the scan incomplete.
- Measure decoded content as UTF-8 bytes and check the remaining total budget before reading the next text entry. Read failures also mark incomplete analysis.
- Accept Linux filename characters that Windows prohibits; reject absolute paths, NULs and traversal names, including JSZip's original unsanitized path.
- Distinguish an empty archive from one containing empty directories.
- Determine archive wrappers before binary filtering or sampling changes the set of root paths. A root image must not cause `src/` to be stripped from source paths.
- Restrict Python dependency arrays to recognized metadata tables. Unrelated tool configuration must not claim installed frameworks.
- Resolve Rust dependency-table aliases, including workspace tables, to their package names.
- Exclude Python virtual environments, installed site-packages and common Python caches from production detection evidence.
- Advance the analysis cache revision so earlier reports are not reused for the changed analyzer.

## Verification

Regression fixtures cover positive and negative dependency evidence, archive path validation, Linux filenames, Unicode content accounting, lockfile inclusion and truncation, empty directories, wrappers and the existing 25,101-file sampling scenario. The full existing ecosystem regression suite runs alongside these cases.

## Limits

Readers remain bounded static analyzers rather than package-manager resolvers. Unknown extensions may retain metadata without source analysis. Large files and projects remain subject to disclosed budgets. Passing synthetic fixtures is not a measurement of real-world precision or recall. No new vulnerability guarantee or rule-count claim is introduced by these corrections.
