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

## Click report follow-up

The Click v3 beta report scanned 173 files with no sampling and correctly found Python, uv, Flit, BSD-3-Clause, Python >=3.10, Pytest and coverage. It also exposed these static-analysis mistakes:

- A `cmd.exe` mention in a Python docstring was treated as an OS-specific operation. Platform checks now mask Python comments and docstrings and require an actionable file or process operation for this warning. Real subprocess calls still produce a review finding.
- README-only headings reported missing guidance when documentation lived in `docs/quickstart.md`, `docs/options.md` and `docs/license.md`. Documentation topics now include dedicated project docs, and sample-project README files are excluded from the project-level documentation summary.
- Type-only imports inside `if TYPE_CHECKING:` were counted as runtime imports. Runtime edges now exclude those guarded imports; circular imports are grouped by strongly connected modules instead of listing many overlapping paths from one group. The graph remains static and cannot prove import-time failure.
- The analysis cache version advances so an unchanged repository scan does not reuse the earlier report.

The repository scan benchmark passed within its 30 second budget; synthetic regression tests cover both the false alerts and true positive examples. This does not constitute a full runtime test of Click on every platform.

## Bottle report follow-up

Reviewed the supplied Bottle report against upstream `pyproject.toml`, `LICENSE`, `README.rst`, and the two pickle call sites in `bottle.py`.

General corrections (no repository-name exceptions):

- Shared compatibility evidence selection now excludes test, fixture, generated, vendor and documentation manifests for production/configuration queries. Root evidence wins deterministically; requirement findings retain the actual selected path.
- A standard MIT body can be recognized without an `MIT License` heading using multiple characteristic clauses. An isolated permission phrase remains insufficient evidence.
- RST/Setext headings count toward documentation coverage, including `Download and Install` and `Example` headings.
- Testing-framework names are deduplicated without case sensitivity.
- An explicit Python build backend takes precedence over a generic Makefile in a Python project.
- Build metadata plus a matching declared single-file module supports Library architecture detection; unrelated scripts do not.
- Pickle calls remain warning-level review signals. A call alone does not prove attacker-controlled input, and nearby signature verification does not justify silently suppressing the finding.
- Cache revision advances to avoid reusing earlier analysis results.

Positive, negative and scope fixtures cover these cases. The full local suite passes 865 checks. No full browser rescan of all 219 Bottle files was performed as part of this follow-up. Framework self-identity, cross-file security flow, and arbitrary packaging layouts remain bounded-analysis limitations. These checks do not establish universal precision or recall.
