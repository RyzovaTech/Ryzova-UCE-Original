# UCE observational real-repository evaluation

This is a **live experiment**, not a claim that UCE is 95% accurate.

- A fixed discovery list of 160 public repositories was collected on 2026-10-19, across Python, JavaScript, TypeScript, Java, PHP, Ruby, Go and Rust (20 each). Selection is not random; it favors relatively small popular projects and can include documentation-heavy projects.
- Four separate GitHub Actions jobs each try 40 shallow clones. A fresh full working tree is used for each scan. Git SHA, scanned-file counts, coverage limits and errors are recorded per project.
- Each repository is analyzed by the actual `scripts/uce-scan.mjs` CLI with explicit safety budgets: 4,000 files and 16 MiB source content. No downloaded project code or dependencies are run or installed; only trusted UCE source is executed.
- GitHub Linguist primary language is an **external comparison proxy**. It may differ legitimately from a UCE primary runtime language, especially in mixed stacks, generated code and documentation.
- Manager/framework comparisons are available only when a **single unambiguous root-level marker** exists. Their marker oracles are not independent expert adjudication, and absent/ambiguous labels are excluded from denominators rather than counted as correct negatives.
- Language agreement, manager-marker agreement and framework-marker agreement are reported separately. Their denominators include only measured cases. A failed clone or analyzer is a failure, not a correctly classified project.
- The benchmark doesn't validate vulnerability findings, runtime compatibility, API correctness, or global precision/recall. Real human-reviewed positive/negative decisions for those modules still need independent evaluation.
- The runner retains **metadata and aggregate findings only** in GitHub Actions artifacts; it deletes cloned source and detailed reports between repositories.

Run: GitHub Actions → **UCE 160 Real Repository Benchmark** → Run workflow (after workflow is on default branch), or push to `bench/uce-real-repository-accuracy-160`.

Data: `testing/real-world/repositories.json`; runner: `testing/real-world/scan-benchmark.mjs`. Each of four output artifacts contains per-repository results with commit IDs and mismatch details.

**Do not automatically change baseline labels or engine code to maximize agreement.** Investigate each mismatch against actual source, and add independent regression fixtures for confirmed defects.
