# 100-repository validation

The corpus spans JavaScript/TypeScript, Python, Go, Rust, PHP, Ruby, Java/Kotlin, .NET and C/C++. `testing/repositories/selection.json` contains exactly 100 distinct repositories.

The GitHub Actions **100 repository validation** workflow scans each checkout with baseline engine `61b355bb67a54aa7ba546cb07993b9b771f52df9` and the PR engine. It records commit SHAs, complete reports, coverage limits, and deduplicated compatibility/extended rule-file deltas as a 90-day artifact. Scanned code and dependencies are not executed. Both engines scan the same checkout. The baseline intentionally retains its original narrower CLI text policy.

Fixes address declaration-only TypeScript packages, test/example build configs, auxiliary package manifests, pnpm workspaces, BSD contributor clauses, Python vendoring, Kotlin/.NET/Java test scopes, dependency-free Go modules, ecosystem root configs, root ignore-file selection, Gradle convention targets, and browser/CLI text-reading parity including .NET metadata.

This is a development corpus, not a fully labeled held-out accuracy benchmark. Removed findings are not automatically confirmed false positives. Extra text coverage can introduce findings. The 25,000-file, 96 MiB text and 2 MiB per-file CLI limits remain; file inventory completeness does not mean all content was read. GitHub archive export-ignore behavior can differ from local checkout scans. Runtime range interpretation, inherited MSBuild settings, and framework-library identity remain review areas. No 90–95% overall accuracy claim is supported.

Local reproduction (use a dedicated scratch directory):

```sh
python3 testing/repositories/run.py /tmp/uce-corpus /path/to/baseline-checkout
```

Each run writes `pinned-manifest.json` and `results.json` plus full before/after reports. Reuse its untouched checkout directory to repeat scans at those recorded commits.
