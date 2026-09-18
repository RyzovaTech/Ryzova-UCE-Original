import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Transpile only local trusted test modules in memory; never execute scanned code.
const root = path.resolve(import.meta.dirname, '..');
const cache = new Map();
const nativeRequire = createRequire(import.meta.url);
function load(file) {
  const resolved = path.resolve(root, file);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} };
  cache.set(resolved, module);
  const source = fs.readFileSync(resolved, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const requireLocal = (specifier) => {
    if (!specifier.startsWith('.')) return nativeRequire(specifier);
    const target = path.resolve(path.dirname(resolved), specifier);
    return load(target.endsWith('.ts') ? target : target + '.ts');
  };
  new Function('require', 'module', 'exports', outputText)(requireLocal, module, module.exports);
  return module.exports;
}
const { detectRegisteredTechnologies, validateTechnologyRegistry, TECHNOLOGY_REGISTRY } = load('src/lib/analyzer/technology-registry.ts');
const { TECHNOLOGY_KNOWLEDGE } = load('src/lib/analyzer/technology-knowledge.ts');
const { ECOSYSTEM_KNOWLEDGE } = load('src/lib/analyzer/ecosystem-knowledge.ts');
const { PLATFORM_KNOWLEDGE } = load('src/lib/analyzer/platform-knowledge.ts');
const { buildTechnologyGraph, PROJECT_CAPABILITY_COUNT } = load('src/lib/analyzer/technology-graph.ts');
const { collectEcosystemDependencies } = load('src/lib/analyzer/ecosystem-dependencies.ts');
const { ADDITIONAL_LANGUAGE_EXTENSIONS } = load('src/lib/analyzer/language-knowledge.ts');
const { detectLanguageProfile } = load('src/lib/analyzer/language-profile.ts');
const { classifyProjectFileScope } = load('src/lib/analyzer/project-scope.ts');
const { detectBrowserCompatibility, resolveBrowserTargets } = load('src/lib/analyzer/browser-compatibility.ts');
const { BROWSER_FEATURES } = load('src/lib/analyzer/browser-knowledge.ts');
const { detectSecurityIntelligence, isNonProductionPath } = load('src/lib/analyzer/security-intelligence.ts');
const { SECURITY_RULES, validateSecurityRules } = load('src/lib/analyzer/security-knowledge.ts');
const { detectCodeIntelligence } = load('src/lib/analyzer/code-intelligence.ts');
const { detectDependencyIntelligence } = load('src/lib/analyzer/intelligence.ts');
const { buildCorrelatedInsights } = load('src/lib/analyzer/correlated-intelligence.ts');
const { detectExtendedIntelligence } = load('src/lib/analyzer/extended-intelligence.ts');
const { CORE_KNOWLEDGE_PACK } = load('src/lib/knowledge/core-pack.ts');
const { validateKnowledgePack, exportKnowledgePack, importKnowledgePack } = load('src/lib/knowledge/validator.ts');
const { buildTrustMetadata } = load('src/lib/analyzer/trust.ts');
const { collectWorkspaceFindings, groupWorkspaceFindings, compareReports, compatibleProjectReports } = load('src/lib/report/workspace.ts');
const { classifyProject } = load('src/lib/analyzer/classifier.ts');
const { detectLanguage, detectStack } = load('src/lib/analyzer/detectors.ts');
const { parseFiles } = load('src/lib/analyzer/parser.ts');
const file = (name, content = '') => ({ path: name, content, size: Buffer.byteLength(content), isDirectory: false });
const pkg = (name, deps) => file(name, JSON.stringify({ dependencies: deps }));
let checks = 0;
function test(name, run) { run(); checks++; console.log('PASS ' + name); }

test('registry definitions are valid and uniquely named', () => assert.deepEqual(validateTechnologyRegistry(), []));
test('empty repository produces no detections', () => assert.deepEqual(detectRegisteredTechnologies([]), []));
test('malformed package manifests do not crash', () => assert.deepEqual(detectRegisteredTechnologies([file('package.json', '{bad')]).filter(x => x.kind !== 'runtime'), []));
test('multiple workspace technologies coexist', () => {
  const ids = detectRegisteredTechnologies([pkg('apps/web/package.json', { react: '18' }), pkg('apps/api/package.json', { express: '4' })]).map(x => x.id);
  assert.ok(ids.includes('react') && ids.includes('express'));
});
test('repeated dependencies do not inflate confidence', () => {
  const one = detectRegisteredTechnologies([pkg('package.json', { react: '18' })]).find(x => x.id === 'react');
  const many = detectRegisteredTechnologies(Array.from({length: 30}, (_, i) => pkg('packages/p' + i + '/package.json', { react: '18' }))).find(x => x.id === 'react');
  assert.equal(one.confidence, many.confidence);
  assert.ok(many.evidence.length <= 8);
});
for (const scope of ['tests', 'fixtures', 'vendor', 'generated', 'docs']) {
  test('exclude ' + scope + ' technology evidence', () => assert.deepEqual(detectRegisteredTechnologies([pkg(scope + '/package.json', { react: '18', pg: '8' })]), []));
}
test('Windows test paths are classified', () => assert.equal(classifyProjectFileScope('tests\\\\unit\\\\file.ts'), 'test'));
test('plain Dart does not imply Flutter', () => assert.ok(!detectRegisteredTechnologies([file('pubspec.yaml', 'name: plain_dart')]).some(x => x.id === 'flutter')));
test('knowledge does not inspect arbitrary prose', () => assert.deepEqual(detectRegisteredTechnologies([file('README.md', 'react pg prisma')]), []));
for (const definition of TECHNOLOGY_KNOWLEDGE) {
  test('dependency fixture: ' + definition.id, () => {
    const detected = detectRegisteredTechnologies([pkg('package.json', { [definition.dependencies[0]]: '1.0.0' })]);
    const match = detected.find(x => x.id === definition.id);
    assert.ok(match);
    assert.equal(match.level, 'likely');
    assert.equal(match.evidence[0].source, 'package.json');
    const negative = detectRegisteredTechnologies([pkg('package.json', { ['not-' + definition.dependencies[0]]: '1.0.0' })]);
    assert.ok(!negative.some(x => x.id === definition.id));
  });
}
for (const [extension, language] of Object.entries(ADDITIONAL_LANGUAGE_EXTENSIONS)) {
  test('language fixture: ' + extension, () => {
    const profiles = detectLanguageProfile([file('src/main' + extension, 'source'), file('vendor/huge.py', 'x'.repeat(1000))]);
    assert.equal(profiles[0].language, language);
    assert.equal(profiles.length, 1);
    assert.equal(classifyProject([file('src/main' + extension, 'source')], []).isSoftware, true);
    assert.equal(detectLanguage([], [file('src/main' + extension, 'source')]), language);
  });
}
test('large JSON payload does not change Node runtime', () => {
  const files = [pkg('package.json', {react: '18'}), file('src/app.js', 'const app = 1'), file('data.json', 'x'.repeat(100000))];
  const stack = detectStack(files, parseFiles(files));
  assert.equal(stack.language, 'JavaScript');
  assert.equal(stack.runtime, 'Node.js');
});
function manifest(ecosystem, name) {
  if (ecosystem === 'python') return file('requirements.txt', name + '>=1.0');
  if (ecosystem === 'cargo') return file('Cargo.toml', '[dependencies]\n' + name + ' = "1.0"');
  if (ecosystem === 'go') return file('go.mod', 'require ' + name + ' v1.0.0');
  return file('composer.json', JSON.stringify({ require: { [name]: '^1.0' } }));
}
for (const definition of ECOSYSTEM_KNOWLEDGE) {
  const signal = definition.ecosystemDependencies[0];
  test('ecosystem fixture: ' + definition.id, () => {
    const fixture = manifest(signal.ecosystem, signal.name);
    assert.ok(detectRegisteredTechnologies([fixture]).some(x => x.id === definition.id));
    assert.ok(!detectRegisteredTechnologies([pkg('package.json', { [signal.name]: '1' })]).some(x => x.id === definition.id));
    assert.ok(!detectRegisteredTechnologies([{ ...fixture, path: 'fixtures/' + fixture.path }]).some(x => x.id === definition.id));
    assert.ok(!detectRegisteredTechnologies([manifest(signal.ecosystem, 'not-' + signal.name)]).some(x => x.id === definition.id));
  });
}
test('requirements ignores comments, includes and URLs', () => {
  const result = collectEcosystemDependencies([file('requirements-dev.txt', '# torch\n-r torch\nhttps://example.com/torch\nSCIKIT_LEARN[extra]>=1 # comment\n')]);
  assert.deepEqual(result.map(x => x.name), ['scikit-learn']);
});
test('Cargo handles aliases and ignores package metadata', () => {
  const result = collectEcosystemDependencies([file('Cargo.toml', '[package]\nname = "tokio"\n[dependencies]\nasync_rt = { package = "tokio", version = "1" }\n# serde = "1"')]);
  assert.deepEqual(result.map(x => x.name), ['tokio']);
});
test('pyproject reads PEP 621 and Poetry dependency declarations', () => {
  const result = collectEcosystemDependencies([file('pyproject.toml', '[project]\ndependencies = [\n "FastAPI>=1",\n "SCIKIT_LEARN[extra]>=1"\n]\n[tool.poetry.dependencies]\npython = "^3.12"\nDjango = "^5"')]);
  assert.deepEqual(result.map(item => item.name), ['fastapi', 'scikit-learn', 'django']);
});
test('Cargo reads workspace, target and dependency-table declarations', () => {
  const result = collectEcosystemDependencies([file('Cargo.toml', '[workspace.dependencies]\nserde = "1"\n[target.\'cfg(unix)\'.dependencies]\ntokio = "1"\n[dependencies.reqwest]\nversion = "1"')]);
  assert.deepEqual(result.map(item => item.name), ['serde', 'tokio', 'reqwest']);
});
test('Go require blocks exclude replace directives', () => {
  const result = collectEcosystemDependencies([file('go.mod', 'require (\n go.uber.org/zap v1.0.0 // indirect\n)\nreplace github.com/spf13/cobra => ./local')]);
  assert.deepEqual(result.map(x => x.name), ['go.uber.org/zap']);
});
test('Composer metadata is not dependency evidence', () => {
  const result = collectEcosystemDependencies([file('composer.json', '{"description":"phpunit/phpunit","require-dev":{"pestphp/pest":"^1"}}')]);
  assert.deepEqual(result.map(x => x.name), ['pestphp/pest']);
});
test('malformed Composer input is safe', () => assert.deepEqual(collectEcosystemDependencies([file('composer.json', 'null'), file('apps/api/composer.json', '{')]), []));
test('browser feature knowledge has unique ids and broad Phase 3 coverage', () => {
  assert.equal(new Set(BROWSER_FEATURES.map(item => item.id)).size, BROWSER_FEATURES.length);
  assert.ok(BROWSER_FEATURES.length >= 25);
});
test('browser targets resolve from package browserslist with provenance', () => {
  const result = resolveBrowserTargets([file('package.json', JSON.stringify({ browserslist: { production: ['chrome >= 100', 'firefox 110', 'safari >= 15.4', 'edge 100'] } }))]);
  assert.equal(result.source, 'package.json#browserslist'); assert.equal(result.usedDefaults, false); assert.equal(result.targets.length, 4);
});
test('browserslistrc exact targets override package targets', () => {
  const result = resolveBrowserTargets([file('.browserslistrc', '[production]\nchrome 90\nsafari >= 14'), file('package.json', JSON.stringify({ browserslist: ['chrome 120'] }))]);
  assert.deepEqual(result.targets, [{ browser: 'Chrome', version: 90 }, { browser: 'Safari', version: 14 }]); assert.equal(result.source, '.browserslistrc');
});
test('unsupported web platform features are tied to configured targets', () => {
  const result = detectBrowserCompatibility([file('.browserslistrc', 'chrome 100\nfirefox 120\nsafari 16\nedge 100'), file('src/app.ts', 'navigator.gpu; navigator.bluetooth; structuredClone(value);')]);
  assert.ok(result.findings.some(item => item.id === 'webgpu' && item.affectedBrowsers.length === 4));
  assert.ok(result.findings.some(item => item.id === 'web-bluetooth' && item.affectedBrowsers.includes('Safari')));
  assert.ok(!result.findings.some(item => item.id === 'structured-clone'));
});
test('browser intelligence excludes test, fixture and generated code', () => {
  const result = detectBrowserCompatibility([file('tests/app.ts', 'navigator.gpu'), file('fixtures/app.ts', 'navigator.gpu'), file('generated/app.ts', 'navigator.gpu')]);
  assert.equal(result.filesScanned, 0); assert.deepEqual(result.findings, []);
});
test('security registry is valid and expands Phase 3 coverage', () => {
  assert.deepEqual(validateSecurityRules(), []); assert.ok(SECURITY_RULES.length >= 20);
});
test('security findings include category, confidence and safe evidence', () => {
  const result = detectSecurityIntelligence([file('src/server.ts', 'const password = "real-production-secret";\nconst agent = { rejectUnauthorized: false };')]);
  assert.ok(result.findings.some(item => item.ruleId === 'SEC001' && item.category === 'secrets' && item.confidence));
  assert.ok(result.findings.some(item => item.ruleId === 'SEC010' && item.category === 'transport'));
  assert.ok(result.findings.every(item => !item.evidence.includes('real-production-secret')));
  assert.ok(result.categoryCounts.secrets >= 1); assert.equal(result.knowledgeVersion, '3.0.0');
});
test('security placeholders and local HTTP endpoints are suppressed', () => {
  const result = detectSecurityIntelligence([file('src/config.ts', 'const apiKey = "replace-me"; const url = "http://localhost:3000/api";')]);
  assert.deepEqual(result.findings, []);
});
test('security rules are language scoped', () => {
  const result = detectSecurityIntelligence([file('src/app.py', 'eval(data)\nconst x = { rejectUnauthorized: false }')]);
  assert.ok(!result.findings.some(item => item.ruleId === 'SEC002' || item.ruleId === 'SEC010'));
});
test('security intelligence excludes non-production paths cross-platform', () => {
  for (const path of ['tests/app.ts', 'docs/example.py', 'vendor/app.php', 'src\\fixtures\\app.ts']) assert.equal(isNonProductionPath(path), true);
  const result = detectSecurityIntelligence([file('examples/server.ts', 'const password = "real-production-secret"')]); assert.deepEqual(result.findings, []);
});
test('unsafe deserialization rules distinguish safe YAML loading', () => {
  const result = detectSecurityIntelligence([file('src/unsafe.py', 'pickle.loads(payload)\nyaml.load(payload)\nyaml.load(payload, Loader=yaml.SafeLoader)')]);
  assert.ok(result.findings.some(item => item.ruleId === 'SEC015')); assert.equal(result.findings.filter(item => item.ruleId === 'SEC016').length, 1);
});
test('API intelligence covers file and framework routes', () => {
  const result = detectCodeIntelligence([
    file('app/api/users/[id]/route.ts', 'export async function GET() {}\nexport function DELETE() {}'),
    file('api.py', '@app.post("/items")\ndef create(): pass'),
    file('UserController.java', '@GetMapping("/users")\nvoid users() {}'),
    file('routes/web.php', "Route::put('/profile', handler);"),
    file('server.go', 'http.HandleFunc("/health", health)'),
  ]);
  for (const route of ['/api/users/:id', '/items', '/users', '/profile', '/health']) assert.ok(result.apiEndpoints.some(item => item.route === route));
  assert.ok(result.frameworksCovered.length >= 5);
});
test('large functions use function span rather than containing file size', () => {
  const manyLines = Array.from({ length: 300 }, (_, index) => `const value${index} = ${index};`).join('\n');
  const result = detectCodeIntelligence([file('src/large.ts', `function tiny() { return 1; }\n${manyLines}`)]);
  assert.equal(result.quality.largeFiles.length, 0); assert.equal(result.quality.largeFunctions.length, 0);
  const largeBody = Array.from({ length: 85 }, () => 'work();').join('\n');
  assert.equal(detectCodeIntelligence([file('src/function.ts', `function huge() {\n${largeBody}\n}`)]).quality.largeFunctions[0].lines, 87);
});
test('dependency intelligence correlates workspace conflicts and mutable sources', () => {
  const result = detectDependencyIntelligence([
    file('package.json', JSON.stringify({ dependencies: { react: '^18', loose: '*', remote: 'git+https://example.com/repo.git' } })),
    file('packages/app/package.json', JSON.stringify({ dependencies: { react: '^19' } })),
    file('fixtures/package.json', JSON.stringify({ dependencies: { ignored: 'latest' } })),
  ], { packageManager: 'pnpm' });
  assert.equal(result.manifestsScanned, 2); assert.equal(result.versionConflicts.length, 1);
  assert.deepEqual(new Set(result.risks.map(item => item.kind)), new Set(['wildcard', 'remote-source', 'version-conflict']));
  assert.ok(!result.risks.some(item => item.name === 'ignored'));
});
test('correlated intelligence prioritizes cross-engine signals', () => {
  const insights = buildCorrelatedInsights({
    securityIntelligence: { findings: [{ id: 'x', ruleId: 'SEC001', title: 'secret', severity: 'critical', file: 'src/a.ts', line: 1, evidence: 'safe', recommendation: 'fix' }], score: 0, filesScanned: 1, rulesExecuted: 1 },
    browserCompatibility: { targets: [], findings: [{ feature: 'WebGPU', kind: 'web-api', file: 'src/a.ts', line: 2, status: 'unsupported', affectedBrowsers: ['Safari'], recommendation: 'fallback' }], score: 80, filesScanned: 1, featuresChecked: 25 },
    dependencyIntelligence: { manager: 'pnpm', total: 1, runtime: 1, development: 0, peer: 0, optional: 0, dependencies: [], duplicateNames: [], versionConflicts: [], risks: [{ name: 'x', version: '*', source: 'package.json', kind: 'wildcard', severity: 'warning', recommendation: 'pin' }], healthScore: 90 },
  });
  assert.equal(insights[0].severity, 'critical'); assert.ok(insights.some(item => item.domain === 'browser')); assert.ok(insights.some(item => item.domain === 'dependencies'));
});
test('browser compatibility distinguishes partial support', () => {
  const result = detectBrowserCompatibility([file('.browserslistrc', 'chrome 115'), file('src/style.css', '.card { & .title { color: red; } }')]);
  assert.equal(result.findings.find(item => item.id === 'css-nesting').status, 'partial');
});
const extendedStack = {
  language: 'TypeScript', primaryLanguage: 'TypeScript', runtime: 'Node.js', runtimes: ['Node.js'], packageManager: 'pnpm', buildTool: 'Vite',
  technologyDetections: [{ id: 'postgres', name: 'PostgreSQL', kind: 'database', confidence: 90, level: 'confirmed', evidence: [] }],
  architecture: { primary: 'SPA', patterns: ['SPA'], confidence: 90, evidence: ['Vite app'] },
  codeIntelligence: { filesAnalyzed: 3, symbols: [], dependencyEdges: [], apiEndpoints: [{ method: 'GET', route: '/api/users', file: 'src/api.ts', line: 1, framework: 'Express' }], entryPoints: [], architectureAreas: {}, quality: { largeFiles: [], largeFunctions: [], todoCount: 0, fixmeCount: 0, circularDependencies: [] } },
};
test('Phase 3.5 exposes every planned intelligence module', () => {
  const intelligence = detectExtendedIntelligence([file('src/app.ts', 'export const app = 1')], extendedStack);
  assert.equal(Object.keys(intelligence.modules).length, 14); assert.equal(intelligence.version, '3.5.0'); assert.ok(intelligence.overallScore >= 0);
  for (const id of ['project', 'runtime', 'platform', 'build', 'testing', 'performance', 'accessibility', 'api', 'database', 'environment', 'license', 'documentation', 'maintainability', 'repository']) assert.equal(intelligence.modules[id].id, id);
});
test('accessibility intelligence finds deterministic HTML and JSX problems', () => {
  const module = detectExtendedIntelligence([file('src/App.tsx', '<div onClick={go}><img src="x.png" /><a target="_blank">Open</a></div>')], extendedStack).modules.accessibility;
  assert.deepEqual(new Set(module.findings.map(item => item.id)), new Set(['A11Y001', 'A11Y003', 'A11Y004']));
});
test('environment intelligence compares usage with safe example declarations', () => {
  const module = detectExtendedIntelligence([file('.env.example', 'PUBLIC_URL=\n'), file('src/config.ts', 'const a = process.env.PUBLIC_URL; const b = process.env.SECRET_TOKEN;')], extendedStack).modules.environment;
  assert.equal(module.metrics.requiredVariables, 2); assert.equal(module.metrics.undocumentedVariables, 1); assert.ok(module.findings[0].title.includes('SECRET_TOKEN'));
});
test('testing, license, documentation and repository readiness are evidence based', () => {
  const files = [file('src/a.ts', 'export const a=1'), file('src/a.test.ts', 'test("a",()=>{})'), file('LICENSE', 'Apache License'), file('.gitignore', 'node_modules'), file('.github/workflows/ci.yml', 'jobs: {}'), file('README.md', '# App\n## Installation\n## Usage\n## Configuration\n## License')];
  const intelligence = detectExtendedIntelligence(files, extendedStack);
  assert.equal(intelligence.modules.testing.metrics.testFiles, 1); assert.equal(intelligence.modules.license.metrics.licenseFile, true); assert.equal(intelligence.modules.documentation.metrics.sections, 4); assert.equal(intelligence.modules.repository.metrics.workflows, true);
});
test('performance, platform, database and maintainability emit bounded findings', () => {
  const repeated = 'const repeatedValue = calculateSomething();\n'.repeat(6); const files = [file('src/a.ts', `${repeated}const x = readFileSync(path); const p = "C:\\\\temp";`), file('src/b.ts', repeated), file('schema.prisma', 'model User { id Int @id }'), file('migrations/001.sql', 'CREATE TABLE users(id int);')];
  const intelligence = detectExtendedIntelligence(files, extendedStack);
  assert.ok(intelligence.modules.performance.findings.some(item => item.id === 'PERF002')); assert.ok(intelligence.modules.platform.findings.some(item => item.id === 'OS001')); assert.ok(Number(intelligence.modules.database.metrics.schemaModels) >= 1); assert.ok(Number(intelligence.modules.maintainability.metrics.duplicatedBlocks) >= 1);
});
const workspaceReport = (id, issueTitles, score = 80, createdAt = '2026-01-01T00:00:00.000Z') => ({
  id, createdAt, analysisVersion: '2.0.0', source: 'upload', classification: { type: 'Software Project', isSoftware: true, reason: 'source' },
  summary: { name: 'workspace-app', language: 'TypeScript', framework: 'React', runtime: 'Node.js', packageManager: 'pnpm', detectedConfigFiles: [], filesScanned: 1, foldersScanned: 1, scanStats: { projectSize: 1, filesFound: 1, filesAnalyzed: 1, filesIgnored: 0, ignoredCategories: [] } },
  stack: { language: 'TypeScript', framework: 'React', runtime: 'Node.js', packageManager: 'pnpm', buildTool: 'Vite', frontend: 'React', backend: 'None', database: 'Unknown', configFiles: [], securityIntelligence: { score: 50, filesScanned: 1, rulesExecuted: 1, findings: [{ id: 'secret', ruleId: 'SEC001', title: 'Secret signal', category: 'secrets', confidence: 'high', severity: 'critical', file: 'src/a.ts', line: 1, evidence: 'safe evidence', recommendation: 'Review secret' }] }, browserCompatibility: { targets: [], score: 80, filesScanned: 1, featuresChecked: 1, findings: [{ id: 'webgpu', feature: 'WebGPU', kind: 'web-api', file: 'src/a.ts', line: 2, status: 'unsupported', affectedBrowsers: ['Safari'], recommendation: 'Add fallback' }] } },
  issues: issueTitles.map((title, index) => ({ id: `${id}-${index}`, title, category: 'runtime', severity: index ? 'warning' : 'critical', description: title, reason: 'evidence', recommendation: `Fix ${title}`, affectedFile: `src/${index}.ts` })),
  categories: [{ id: 'runtime', label: 'Runtime', status: 'warning', score, issues: [], summary: 'runtime' }], score: { runtime: score, dependencies: score, configuration: score, structure: score, environment: score, security: score, deployment: score, performance: score, overall: score }, detectedFiles: [], timeline: [], notes: [],
});
test('Phase 4 workspace unifies compatibility and intelligence findings', () => {
  const findings = collectWorkspaceFindings(workspaceReport('one', ['Runtime mismatch']));
  assert.deepEqual(new Set(findings.map(item => item.module)), new Set(['runtime', 'security/secrets', 'browser']));
  assert.equal(findings.length, 3);
});
test('Phase 4 similar finding groups remain deterministic', () => {
  const report = workspaceReport('group', ['Repeated issue', 'Repeated issue']);
  report.issues[1].affectedFile = 'src/other.ts';
  report.issues[1].severity = 'critical';
  const groups = groupWorkspaceFindings(collectWorkspaceFindings(report));
  assert.equal(groups.find(item => item.title === 'Repeated issue').findings.length, 2);
});
test('Phase 4 scan comparison tracks new resolved and persisting findings', () => {
  const baseline = workspaceReport('old', ['Persisting', 'Resolved'], 70);
  const current = workspaceReport('new', ['Persisting', 'New'], 85, '2026-02-01T00:00:00.000Z');
  current.issues[0].id = baseline.issues[0].id;
  const comparison = compareReports(current, baseline);
  assert.equal(comparison.scoreDelta, 15);
  assert.ok(comparison.newFindings.some(item => item.title === 'New'));
  assert.ok(comparison.resolvedFindings.some(item => item.title === 'Resolved'));
  assert.ok(comparison.persistingFindings.some(item => item.title === 'Persisting'));
});
test('Phase 4 comparison only offers matching project identities', () => {
  const current = workspaceReport('current', [], 80, '2026-03-01T00:00:00.000Z');
  const older = workspaceReport('older', [], 70, '2026-01-01T00:00:00.000Z');
  const other = workspaceReport('other', [], 90); other.summary.name = 'different-app';
  assert.deepEqual(compatibleProjectReports(current, [current, other, older]).map(item => item.id), ['older']);
});
test('Phase 5 core knowledge pack validates against schema v1', () => {
  const validation = validateKnowledgePack(CORE_KNOWLEDGE_PACK);
  assert.equal(validation.valid, true); assert.equal(validation.signed, false);
  assert.ok(validation.warnings.some(item => item.includes('unsigned')));
  assert.equal(new Set(CORE_KNOWLEDGE_PACK.rules.map(item => item.id)).size, CORE_KNOWLEDGE_PACK.rules.length);
});
test('Phase 5 knowledge pack rejects duplicate rules and unknown permissions', () => {
  const pack = JSON.parse(exportKnowledgePack(CORE_KNOWLEDGE_PACK));
  pack.permissions.push('network-access'); pack.rules.push({ ...pack.rules[0] });
  const validation = validateKnowledgePack(pack);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(item => item.includes('Unsupported permission')));
  assert.ok(validation.errors.some(item => item.includes('Duplicate rule id')));
});
test('Phase 5 knowledge pack import is deterministic and signature-aware', () => {
  const imported = importKnowledgePack(exportKnowledgePack(CORE_KNOWLEDGE_PACK));
  assert.equal(imported.validation.valid, true); assert.equal(imported.pack.id, CORE_KNOWLEDGE_PACK.id);
  assert.equal(importKnowledgePack('{broken').validation.valid, false);
  assert.equal(importKnowledgePack(exportKnowledgePack(CORE_KNOWLEDGE_PACK), true).validation.valid, false);
});
test('Phase 5 trust metadata is local-only and scoring weights are transparent', () => {
  const trust = buildTrustMetadata();
  assert.equal(trust.localOnly, true); assert.equal(trust.networkAccessUsed, false); assert.equal(trust.sourceUploaded, false);
  assert.equal(Math.round(Object.values(trust.scoreWeights).reduce((sum, value) => sum + value, 0) * 100), 100);
  assert.equal(trust.knowledgePacks[0].id, CORE_KNOWLEDGE_PACK.id);
});
for (const definition of PLATFORM_KNOWLEDGE.filter(item => item.dependencies?.length || item.files?.length || item.filePrefixes?.length)) {
  test('platform marker fixture: ' + definition.id, () => {
    const fixture = definition.dependencies?.length
      ? pkg('package.json', { [definition.dependencies[0]]: '1' })
      : definition.files?.length
        ? file(definition.files[0], 'marker')
        : file(definition.filePrefixes[0] + 'ts', 'marker');
    assert.ok(detectRegisteredTechnologies([fixture]).some(item => item.id === definition.id));
  });
}
test('platform path pattern recognizes GitHub Actions', () => {
  assert.ok(detectRegisteredTechnologies([file('.github/workflows/ci.yml', 'jobs: {}')]).some(item => item.id === 'ci2-github-actions'));
});
test('Phase 2 registry coverage gates', () => {
  const counts = Object.fromEntries(['package-manager', 'build-tool', 'runtime', 'database', 'testing', 'cloud', 'ci-cd'].map(kind => [kind, PLATFORM_KNOWLEDGE.filter(item => item.kind === kind).length]));
  assert.deepEqual(counts, { 'package-manager': 40, 'build-tool': 60, runtime: 25, database: 50, testing: 60, cloud: 40, 'ci-cd': 25 });
  assert.equal(PROJECT_CAPABILITY_COUNT, 25);
  assert.ok(TECHNOLOGY_REGISTRY.length >= 600);
});
test('technology graph exposes soft capabilities and evidence relationships', () => {
  const detections = detectRegisteredTechnologies([
    pkg('package.json', { react: '18', vite: '5', jest: '29', pg: '8' }),
    file('vercel.json', '{}'),
  ]);
  const graph = buildTechnologyGraph(detections);
  assert.ok(graph.capabilities.some(item => item.id === 'web-frontend'));
  assert.ok(graph.capabilities.some(item => item.id === 'testing'));
  assert.ok(graph.capabilities.some(item => item.id === 'database'));
  assert.ok(graph.relationships.some(item => item.type === 'builds-with'));
  assert.ok(graph.relationships.some(item => item.type === 'deploys-to'));
  assert.ok(graph.relationships.every(item => item.evidence));
});
test('shared database drivers do not imply compatible database brands', () => {
  const ids = detectRegisteredTechnologies([pkg('package.json', { pg: '8', mysql2: '3', 'cassandra-driver': '4' })]).map(item => item.id);
  for (const id of ['db2-cockroachdb', 'db2-timescaledb', 'db2-scylladb', 'db2-tidb', 'db2-yugabytedb']) assert.ok(!ids.includes(id));
});
test('generic cloud filenames require vendor evidence', () => {
  const generic = detectRegisteredTechnologies([
    file('app.yaml', 'name: app'), file('service.yaml', 'kind: Service'),
    file('manifest.yml', 'name: app'), file('template.yaml', 'kind: Template'),
    file('.gitlab-ci.yml', 'build:\n  script: echo ok'),
  ]).map(item => item.id);
  for (const id of ['cloud2-google-app-engine', 'cloud2-google-cloud-run', 'cloud2-gitlab-pages', 'cloud2-cloud-foundry', 'cloud2-openshift']) assert.ok(!generic.includes(id));
  const exact = detectRegisteredTechnologies([
    file('app.yaml', 'runtime: nodejs20'), file('service.yaml', 'apiVersion: serving.knative.dev/v1'),
    file('manifest.yml', 'applications:\n- name: app'), file('template.yaml', 'apiVersion: template.openshift.io/v1'),
    file('.gitlab-ci.yml', 'pages:\n  script: publish'),
  ]).map(item => item.id);
  for (const id of ['cloud2-google-app-engine', 'cloud2-google-cloud-run', 'cloud2-gitlab-pages', 'cloud2-cloud-foundry', 'cloud2-openshift']) assert.ok(exact.includes(id));
});
test('Next.js does not imply Turbopack without its command flag', () => {
  assert.ok(!detectRegisteredTechnologies([pkg('package.json', { next: '16' })]).some(item => item.id === 'build2-turbopack'));
  assert.ok(detectRegisteredTechnologies([file('package.json', '{"dependencies":{"next":"16"},"scripts":{"dev":"next dev --turbopack"}}')]).some(item => item.id === 'build2-turbopack'));
});
console.log(JSON.stringify({ checks, technologies: TECHNOLOGY_REGISTRY.length, additionalLanguages: new Set(Object.values(ADDITIONAL_LANGUAGE_EXTENSIONS)).size }));
