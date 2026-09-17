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

## How it works

Use the browser-based analyzer with either a ZIP project archive or a public GitHub repository.
ZIP archives are analyzed locally in the browser. A public repository is downloaded only when its
URL is explicitly provided, and its project files are then analyzed in-browser. UCE does not use
AI-generated guesses for compatibility findings.

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
