# Ryzova UCE v3.0.0-beta.1 — First Public Web Beta

**Live web app:** https://uce.ryzova.com/

Ryzova UCE (Universal Compatibility Engine) is an open-source, local-first developer tool that statically analyzes software projects and reports potential compatibility and configuration problems before deployment.

## In this web beta

- Analyze a ZIP project in your browser or explicitly load a public GitHub repository for in-browser analysis.
- Identify languages, frameworks, runtimes, build tools, package managers, manifests, and dependency signals.
- Review deterministic compatibility, browser-support, security, code-quality, and architecture observations with evidence and suggested next steps.
- Run scans using a Web Worker, with bounded input processing, cancellation/resume and local report caching.
- Use versioned V3 knowledge packs with scope, confidence, evidence requirements, and bounded rule execution.
- Benefit from fixes to report-cache identity, ambiguous language/toolchain recognition, and browser-support false positives caused by comments or string literals.

## Verification and limitations

The exact-source 1,000-repository benchmark recorded **999 successful scans**, **955/998 (95.69%) agreement with GitHub's primary-language label**, **535/535 root package-manager marker agreement** where an unambiguous marker was available, and **900/999 scans with complete coverage**. These are *measured benchmark agreements*, not an overall compatibility or security accuracy percentage.

Small author-labelled diagnostic suites recorded 25/25 security decisions and 17/17 browser-compatibility decisions following the browser false-positive fixes. They are **not independent human-adjudicated precision/recall studies**.

This is **beta software**. Findings are static evidence, not proof of runtime behaviour or comprehensive vulnerability detection. Large or unusual repositories may be truncated or sampled; absence of a finding does not guarantee compatibility or security. Treat uncertain findings as review items and independently validate consequential changes.

Details:
- [Pinned 1,000-repository evidence and paired comparison](https://github.com/RyzovaTech/Ryzova-UCE-Original/blob/main/testing/real-world/RESULTS-1000-PINNED-POSTFIX.md)
- [Independent human-adjudication work item](https://github.com/RyzovaTech/Ryzova-UCE-Original/issues/62)
- [Project README](https://github.com/RyzovaTech/Ryzova-UCE-Original#readme)

## Access and licensing

- **Web application:** https://uce.ryzova.com/
- **Source code:** https://github.com/RyzovaTech/Ryzova-UCE-Original
- **License:** [Mozilla Public License 2.0 (MPL-2.0)](https://github.com/RyzovaTech/Ryzova-UCE-Original/blob/main/LICENSE)

This release is for the **hosted web app and source code**. No desktop installer or prebuilt binary is included. GitHub-generated source archives are source snapshots rather than ready-to-run installers.

**Release source commit:** `71856185231e7a5abe9b20cac008b25587cc272f` — the version verified in production and by GitHub CI when preparing this release.
