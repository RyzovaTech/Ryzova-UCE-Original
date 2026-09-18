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
