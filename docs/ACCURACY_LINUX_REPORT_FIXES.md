# Linux report accuracy corrections

The uploaded Linux scan exposed three reproducible reporting and lexical-evidence defects:

- Security and browser findings accumulated after the core pass were absent from the summary notes. Final batch reconciliation now updates those notes and correlated insights. Partial scans no longer retain the unconditional “No compatibility action is required” recommendation. The compatibility score still describes the core pass; batch notes and readiness state explain its limits.
- Batch issues duplicated their canonical security/browser findings in the workspace and SARIF. Matching mirrors are excluded while orphaned legacy issues remain visible. Legacy `file.ext:line` locations are separated into a URI and source region.
- Rust documentation mentioning “function was” was mistaken for a function declaration. Symbol detection now masks verified comments and literals, preserves offsets, and uses Rust, C/C++, and Go declaration patterns. JavaScript imports and routes retain their string arguments while excluding verified prose matches. This remains bounded static evidence, not a complete parser for these languages.

The analysis cache version increases to 18 so new scans cannot reuse results from the previous detector. Six focused regression tests run in CI alongside the existing accuracy and release gates.

This update does not establish 90–95% global accuracy, suppress genuine review signals such as pickle or weak hash usage, or constitute a new full Linux scan. The uploaded scan remains partial, and browser findings in rustdoc assets need documentation-specific target review.
