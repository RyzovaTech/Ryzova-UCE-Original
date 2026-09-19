# Ryzova UCE — Universal Compatibility Engine

**Ryzova UCE™ (Universal Compatibility Engine)** is an open-source developer tool from
[Ryzova](https://www.ryzova.com/) for analyzing software projects and identifying compatibility
issues before deployment.

- **Official website:** [uce.ryzova.com](https://uce.ryzova.com/)
- **Official repository:** [RyzovaTech/Ryzova-UCE-Original](https://github.com/RyzovaTech/Ryzova-UCE-Original)
- **Ryzova:** [www.ryzova.com](https://www.ryzova.com/)

## What Ryzova UCE analyzes

UCE inspects the technical signals that affect whether a software project can be installed, built,
tested, or deployed reliably. Its deterministic analysis covers:

- Project structure and configuration
- Languages, frameworks, runtimes, and build tools
- Package managers, dependencies, and lockfiles
- Runtime, dependency, configuration, and structure compatibility risks
- Findings organized by severity, impact, and recommended next steps
- Browser, security, architecture, API, database, testing, accessibility, performance, license,
  documentation, repository, deployment, and platform intelligence

## How it works

Use the browser-based analyzer with either a ZIP project archive or a public GitHub repository.
ZIP archives are analyzed locally in the browser. A public repository is downloaded only when its
URL is explicitly provided, and its project files are then analyzed in-browser. UCE does not use
AI-generated guesses for compatibility findings.

Large projects are analyzed with explicit file and memory budgets. If source is sampled or content
is truncated, the report records the exact limitation instead of presenting partial coverage as a
complete scan.

## Browser, CLI, and CI usage

The web application runs analysis in a Web Worker and supports cancellation, resume, progressive
identity results, and a bounded local cache.

```bash
npm install
npm run uce:scan -- /path/to/project --output=uce-report.json
npm run uce:ci -- uce-report.json --min-score=80 --max-critical=0 --sarif=uce-results.sarif
```

The CLI reads project files but never executes project code. GitHub Actions can upload the SARIF
output to code scanning for pull-request annotations.

## Knowledge packs

UCE knowledge packs use a versioned JSON schema, documented permissions, optional Ed25519
publisher signatures, and declarative detector rules. Organization packs require explicit approval;
pack rules are data and are not executed as arbitrary JavaScript. See
[Knowledge packs](docs/KNOWLEDGE_PACKS.md), the [V3 rule-platform preview](docs/V3_RULE_PLATFORM.md), [Phase 5 completion](docs/PHASE_5_COMPLETE.md), and the
[five-phase major completion baseline](docs/ROADMAP_COMPLETION.md).

## Who it is for

Ryzova UCE is intended for developers, software teams, indie hackers, and open-source maintainers
who need a practical compatibility baseline before debugging, contributing to, or deploying a
project.

## Open source

Ryzova UCE is licensed under the [Apache License 2.0](LICENSE). Contributions, improvements, bug
reports, and factual documentation updates are welcome.

See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change. To report a vulnerability,
follow the private disclosure guidance in [SECURITY.md](SECURITY.md).

## Project identity

Ryzova UCE is a product and open-source project from Ryzova; it is not a separate company or
organization. The canonical organization identity is [Ryzova](https://www.ryzova.com/), and this is
the official source repository for the Universal Compatibility Engine.

For a concise factual overview suitable for future community introductions, see
[docs/PROJECT-INTRODUCTION.md](docs/PROJECT-INTRODUCTION.md).
