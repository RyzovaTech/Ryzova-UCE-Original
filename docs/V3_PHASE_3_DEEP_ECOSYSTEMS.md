# V3 Phase 3 — Deep ecosystem rules

Phase 3 adds 3,500 versioned rules in 13 packs to the previous 3,000 V3 rules. The executable inventory is 6,500 unique IDs. Read the [generated index](generated/V3_PHASE3_RULES.md) for the exact rule IDs and allocations.

| Pack | Evidence area |
| --- | --- |
| mobile | Android/Gradle, iOS/Swift, Flutter/Dart, React Native |
| desktop | Electron, Tauri, Qt-related packages and .NET desktop |
| ai-data | AI/ML libraries and data processing |
| games | Game engine dependencies |
| blockchain | Chain tooling and libraries |
| embedded | Embedded, IoT and microcontroller libraries |
| infrastructure | IaC packages and Terraform migration signature |
| kubernetes | Kubernetes/Helm libraries and retired API signatures |
| database | Database clients and ORMs |
| monorepo | Workspace and monorepo tools |
| serverless | Serverless SDKs and frameworks |
| extensions | Browser extension tools and Manifest V2 migration signature |
| cms-docs | CMS and documentation tooling |

Version rules check declared dependency text for floating releases, pre-releases, snapshots, Git sources, unpinned branches, local links, unbounded ranges, zero-major versions, wildcard ranges and unresolved placeholders. They request *review*, rather than claiming a specific vulnerable release or breaking change. Nine additional rules match source signatures for documented migration paths. The rules run only when the relevant technology is in the scan context and the file scope permits it. Declared dependencies and static signatures cannot verify installed/transitive versions, runtime behavior or full platform compatibility; a lockfile, version catalog, or project-specific configuration can change the effective version.

The default pack registry lives outside analyzer core. New packs can be registered without changing the analyzer. Validate with `npm test`, `npm run check`, `npm run build`, and regenerate the index using `npm run docs:rules`. Current validation exercises schema/graph uniqueness, positive and negative evidence, Dart/Cargo manifests and the previous fixtures. It does **not** establish real-world migration accuracy across 6,500 independent projects.

Primary migration references: [Chrome extension migration](https://developer.chrome.com/docs/extensions/develop/migrate), [Kubernetes API deprecations](https://kubernetes.io/docs/reference/using-api/deprecation-guide/), [Terraform version constraints](https://developer.hashicorp.com/terraform/language/expressions/version-constraints), and [Android build version upgrade strategies](https://developer.android.com/build/version-upgrade-strategies).
