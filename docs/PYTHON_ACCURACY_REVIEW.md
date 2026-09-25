# Python report accuracy fixes

Validated against the itsdangerous report and current upstream Python source, plus synthetic positive and negative fixtures.

- Read PEP 621 requires-python and Poetry Python constraints; retain setup.py, setup.cfg and version-file support.
- Detect Flit, Setuptools, Hatchling, Poetry and PDM build backends from build-system metadata.
- Include Python project, optional, development-group and build dependencies in dependency evidence. Group references are not packages. Different Python constraints are not automatically declared conflicts.
- Recognize BSD redistribution terms, CHANGES/HISTORY/NEWS and contributing documentation in common formats.
- Recognize tool.coverage sections and combine testing evidence across modules.
- Mask Python comments and strings before extracting def/class declarations. Preserve source line offsets and resolve common relative and src-layout imports.
- Do not infer Python dead modules or brace-based call graphs from incomplete import/parser support.
- Exclude Python documentation matches from security evidence. Legacy hash findings require context review; a SHA-1 match alone does not establish an HMAC vulnerability.
- Show browser checks as not applicable when no browser source files were analyzed.
- Invalidate previous cached analyses and describe renormalized category scoring accurately.

## Boundaries

Python readers are bounded static readers, not a full TOML/Python parser or environment resolver. Dynamic imports, arbitrary namespace/package roots, executable setup.py metadata, dependency group inclusion expansion, and installed dependency resolution are not fully modeled. Files analyzed is not proof of semantic coverage. No claim of complete security or runtime compatibility is made.

## Verification

Regression suite covers metadata present/absent, comments, unrelated TOML sections, dependency extras and group references, package symbols, relative imports, root test files, documentation and real hash usage. A separate check of upstream itsdangerous metadata and eight source modules found Flit, Library, 15 declared dependency entries, 79 symbols and 21 internal import edges. This was a source subset check, not a fresh scan of the complete upstream repository.
