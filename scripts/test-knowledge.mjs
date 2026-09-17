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
console.log(JSON.stringify({ checks, technologies: TECHNOLOGY_REGISTRY.length, additionalLanguages: new Set(Object.values(ADDITIONAL_LANGUAGE_EXTENSIONS)).size }));
