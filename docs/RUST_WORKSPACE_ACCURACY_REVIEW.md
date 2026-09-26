# Rust workspace accuracy follow-up

The supplied Zed report recorded 3,880 analyzed files, 61,288 ms scan time, and partial content coverage. Its root Cargo manifest was reviewed upstream and is a virtual workspace.

## General corrections

- Root Cargo, Go, Maven, Gradle, Composer, Bundler, Mix, Pub and Swift manifests take precedence over nested Python helper manifests when selecting the primary package manager.
- Root Cargo workspace declarations identify Cargo Workspaces and supply Monorepo architecture evidence.
- Virtual Cargo workspaces do not require package name/version/license/edition fields. Package checks use their own table, recognize workspace inheritance syntax and license-file, and do not confuse dependency names with package metadata.
- Root README selection no longer depends on archive enumeration order or a nested helper README.
- Named root licenses such as LICENSE-APACHE and LICENSE-GPL count as license evidence, and ZIP reading retains their text.
- Conventional Rust test filenames, test_fixture directories and vendored directories receive non-production scopes.
- MVC requires model, view and controller structure together. Clean/hexagonal requires domain plus boundary structure. A detected workspace is not assumed to have a single deployment boundary solely from multiple manifests.
- Analysis cache revision advances.

## Validation and remaining limits

Positive, negative and scope fixtures cover the changes alongside the existing suite (871 checks). No Zed-specific name exception was added.

This is not a full Zed rescan or a proof of universal accuracy. Cargo dependency inventory/version resolution is not yet complete in the report's dependency intelligence, which primarily inventories npm and Python declarations. Rust inline test modules, macro expansion, target-gated platform code, native desktop self-identification and cross-file flow remain limitations. Filename scoping is heuristic. The bounded Cargo reader is not a full TOML parser or Cargo resolver. The reported 61-second scan was not reproduced or claimed fixed. Existing partial-content labels and memory budgets remain active.
