# UCE V3 Core Rules

Bootstrap executable rules for the UCE V3 rule platform.

- Pack: `com.ryzova.uce.v3-core@3.0.0-alpha.1`
- Publisher: RyzovaTech
- Schema: v3
- Rules: 5

## Rules

### Mutable container base tag

- ID: `build.container.latest-tag`
- Module: `build`
- Severity: `warning`
- Confidence: `confirmed`
- Technologies: `docker`
- Scope: `configuration`

Detects Docker FROM declarations that use the mutable latest tag.

**Recommendation:** Pin the base image to an intentional version or immutable digest.

**False-positive notes:**
- Local-only development images may intentionally track latest.

**References:**
- https://docs.docker.com/build/building/best-practices/

### TypeScript strict mode disabled

- ID: `build.typescript.strict-disabled`
- Module: `build`
- Severity: `info`
- Confidence: `confirmed`
- Technologies: `typescript`
- Scope: `configuration`

Detects an explicit false value for compilerOptions.strict.

**Recommendation:** Enable strict mode incrementally and address the resulting type errors.

**False-positive notes:**
- Migration branches may disable strict mode temporarily.

**References:**
- https://www.typescriptlang.org/tsconfig/strict.html

### DOM HTML assignment

- ID: `code.web.inner-html-assignment`
- Module: `code`
- Severity: `warning`
- Confidence: `possible`
- Technologies: `javascript`, `typescript`
- Scope: `production`

Locates direct innerHTML assignments for review.

**Recommendation:** Prefer safe DOM APIs or sanitize untrusted HTML before assignment.

**False-positive notes:**
- Constant trusted markup can be safe.

**References:**
- https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML

### Unpinned React dependency

- ID: `dependency.npm.unpinned-react`
- Module: `dependency`
- Severity: `warning`
- Confidence: `confirmed`
- Technologies: `react`
- Scope: `configuration`

Detects wildcard or latest React declarations.

**Recommendation:** Use an intentional compatible version range and commit the lockfile.

**References:**
- https://docs.npmjs.com/specifying-dependencies-and-devdependencies-in-a-package-json-file

### Dynamic code evaluation

- ID: `security.javascript.dynamic-eval`
- Module: `security`
- Severity: `warning`
- Confidence: `likely`
- Technologies: `javascript`, `typescript`
- Scope: `production`

Detects direct eval calls in production JavaScript and TypeScript source.

**Recommendation:** Replace dynamic evaluation with explicit parsing or safe dispatch.

**False-positive notes:**
- Generated parsers and sandbox implementations require manual review.

**References:**
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval
