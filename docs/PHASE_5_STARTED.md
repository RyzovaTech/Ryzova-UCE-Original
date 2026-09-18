# Phase 5 Started — Production Hardening and UCE Ecosystem

The first Phase 5 increment establishes production-facing contracts before changing
the scanner execution model.

## Completed in this increment

- Knowledge-pack schema version 1
- Built-in UCE Core Knowledge manifest with independently versioned rule families
- Deterministic pack validation, JSON import, and JSON export
- Permission allowlist and rejection of duplicate or malformed rules
- Ed25519/SHA-256 signature-envelope validation contract
- Clear distinction between built-in trust, signed metadata, and verified publishers
- Report trust metadata: local-only, network access, source-upload state, limitations,
  knowledge versions, scoring formula, and exact category weights
- SARIF 2.1.0 export in Expert mode
- Headless `uce:ci` report quality gate with score and severity thresholds
- CI-generated SARIF suitable for GitHub code scanning
- GitHub Actions report-gate and SARIF upload step
- Positive, negative, import, signature, and trust-metadata regression checks

## CLI example

```bash
npm run uce:ci -- report.json --min-score=80 --max-critical=0 \
  --max-warning=25 --sarif=uce-results.sarif
```

Exit codes are stable: `0` passes policy, `1` fails configured thresholds, and `2`
means the report or command input is invalid.

## Deliberately not claimed complete yet

- The signature envelope is validated, but cryptographic signature verification and
  publisher trust stores are not enabled yet.
- CI currently consumes an exported UCE report; direct repository scanning comes with
  the worker/CLI scanner increment.
- The 100+ real-world fixture corpus, Web Worker execution, incremental scanning,
  caching, cancellation/resume, sampling, and performance benchmarks remain Phase 5 work.
- Pull-request annotations depend on GitHub consuming the generated SARIF artifact.

This scope avoids claiming production guarantees before the corresponding fixtures,
benchmarks, browser checks, and security self-scan gates exist.
