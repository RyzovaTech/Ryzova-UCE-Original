# UCE Detector Architecture

UCE uses deterministic, evidence-based detection. It does not send source code to an AI service.

## Phase 1 foundation

Technology knowledge is declared in `src/lib/analyzer/technology-registry.ts`. The evaluator is generic: adding a technology definition does not require another detector branch.

Each definition may use one or more signals:

- dependency names;
- exact marker files;
- configuration filename prefixes;
- repository path patterns;
- content signatures limited to known manifest files.

Every matched signal becomes structured evidence with a source, description, and weight. Independent signals are combined into a confidence score and one of three soft-detection levels:

- `confirmed` — confidence of at least 80;
- `likely` — confidence of at least 50;
- `possible` — lower-confidence evidence that requires review.

The existing `framework`, `frameworks`, `runtime`, and `runtimes` report fields remain available for backward compatibility. New consumers should also read `technologyDetections` and `knowledgeVersion`.

## Scope safety

`project-scope.ts` classifies paths as production, configuration, test, fixture, generated, vendor, or documentation. Technology and language evidence excludes test fixtures, generated output, and vendored dependencies by default. This prevents demo projects and mock credentials from being treated as production evidence.

## Adding knowledge

1. Add a stable, lowercase, hyphenated ID.
2. Select the most precise technology kind.
3. Prefer dependency and manifest signals over generic content searches.
4. Avoid signatures that can match normal prose or source comments.
5. Include more than one independent signal where possible.
6. Run `npm run check` and `npm run build`.

The registry validates duplicate IDs, malformed IDs, missing display names, and definitions without signals at module load time.

## Compatibility promise

Phase 1 only adds optional report fields. Existing stored reports and integrations remain valid. Future knowledge packs can build on the same evidence schema without changing the analyzer core.
