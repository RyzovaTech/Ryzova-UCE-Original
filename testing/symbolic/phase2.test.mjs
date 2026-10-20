import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../../scripts/trusted-module-loader.mjs';

const { evaluateSymbolicReasoning: evaluate } = load('src/lib/symbolic/reasoner.ts');
const file = (path, content) => ({
  path, content, size: typeof content === 'string' ? Buffer.byteLength(content) : 0, isDirectory: false,
});
const json = (path, value) => file(path, JSON.stringify(value));
const cases = (files, domain) => evaluate(files).decisions.filter(d => d.domain === domain);
const get = (files, domain) => cases(files, domain)[0];

test('Node runtime conflict supplies both workspace paths and actual pin line', () => {
  const r = evaluate([json('package.json', { engines: { node: '>=22' } }), file('.nvmrc', '# pin\n20\n')]);
  assert.deepEqual(r.counts, { conflict: 1, satisfiable: 0, unknown: 0 });
  assert.deepEqual(r.decisions[0].facts.map(f => [f.file, f.value, f.line]), [
    ['package.json', '>=22', undefined], ['.nvmrc', '20', 2],
  ]);
});
test('Node partial overlap is satisfiable, never a runtime guarantee', () => {
  const r = get([json('package.json', { engines: { node: '>=20.5' } }), file('.node-version', '20')], 'runtime');
  assert.equal(r.status, 'satisfiable');
  assert.match(r.explanation, /not verified/);
});
test('unknown and ambiguous runtime pins are not declared conflicts', () => {
  for (const code of ['lts/*', 'latest', '20\n22', '20.1.2-beta.1', 'NODE_VERSION']) {
    assert.equal(get([json('package.json', { engines: { node: '>=22' } }), file('.nvmrc', code)], 'runtime').status, 'unknown');
  }
  assert.equal(get([json('package.json', {}), file('.nvmrc', '18')], 'runtime').status, 'unknown');
});
test('workspaces are isolated, and test/vendor scope excluded', () => {
  const r = evaluate([
    json('apps/a/package.json', { engines: { node: '>=22' } }),
    file('apps/b/.nvmrc', '18'),
    json('tests/package.json', { engines: { node: '>=22' } }), file('tests/.nvmrc', '18'),
    json('node_modules/pkg/package.json', { engines: { node: '>=22' } }), file('node_modules/pkg/.nvmrc', '18'),
  ]);
  assert.equal(r.decisions.length, 0);
});
test('npm lock version contradicting range gives dependency conflict with paired evidence', () => {
  const r = get([
    json('package.json', { dependencies: { react: '^18.2.0' } }),
    json('package-lock.json', { packages: { 'node_modules/react': { version: '19.0.0' } } }),
  ], 'dependency');
  assert.equal(r.status, 'conflict');
  assert.deepEqual(r.facts.map(x => x.file), ['package.json', 'package-lock.json']);
});
test('valid scoped packages and sibling-lock isolation', () => {
  const results = cases([
    json('apps/a/package.json', { dependencies: { '@scope/widget': '~2.1.0', react: '^18.2.0' } }),
    json('apps/a/package-lock.json', { packages: {
      'node_modules/@scope/widget': { version: '2.1.7' }, 'node_modules/react': { version: '18.3.0' },
    } }),
    json('apps/b/package-lock.json', { packages: { 'node_modules/react': { version: '19.0.0' } } }),
  ], 'dependency');
  assert.equal(results.length, 2);
  assert.ok(results.every(x => x.status === 'satisfiable' && x.workspace === 'apps/a'));
});
test('malformed and incomplete lock evidence stays unknown', () => {
  for (const lock of [
    file('package-lock.json', '{bad'),
    json('package-lock.json', { packages: {} }),
    json('package-lock.json', { packages: { 'node_modules/react': { version: '18.3.0-beta.1' } } }),
    json('package-lock.json', { packages: { 'node_modules/react': { version: false } } }),
  ]) assert.equal(get([json('package.json', { dependencies: { react: '^18.2.0' } }), lock], 'dependency').status, 'unknown');
  assert.equal(cases([json('package.json', { dependencies: { react: '^18.2.0' } })], 'dependency').length, 0);
  assert.equal(get([json('package.json', { dependencies: { react: 'workspace:*' } }),
    json('package-lock.json', { packages: { 'node_modules/react': { version: '19.0.0' } } })], 'dependency').status, 'unknown');
});
test('ESM + explicitly emitted CommonJS yields evidenced configuration conflict', () => {
  const r = get([
    json('package.json', { type: 'module' }),
    file('tsconfig.json', '{ // comment\n"compilerOptions": {"module": "CommonJS",}, }'),
  ], 'configuration');
  assert.equal(r.status, 'conflict');
  assert.deepEqual(r.facts.map(f => f.file), ['package.json', 'tsconfig.json']);
});
test('noEmit, extends and malformed TypeScript config are never proven conflicts', () => {
  const pkg = json('package.json', { type: 'module' });
  for (const ts of [
    { compilerOptions: { module: 'CommonJS', noEmit: true } },
    { compilerOptions: { module: 'CommonJS', emitDeclarationOnly: true } },
    { extends: './base.json', compilerOptions: { module: 'CommonJS' } },
    { compilerOptions: {} },
  ]) assert.equal(get([pkg, json('tsconfig.json', ts)], 'configuration').status, 'unknown');
  assert.equal(get([pkg, json('tsconfig.json', { compilerOptions: { module: 'ESNext' } })], 'configuration').status, 'satisfiable');
  assert.equal(get([pkg, file('tsconfig.json', 'not json')], 'configuration').status, 'unknown');
});
test('root package config cannot match a different nested workspace', () => {
  assert.equal(evaluate([
    json('package.json', { type: 'module' }),
    json('apps/b/tsconfig.json', { compilerOptions: { module: 'CommonJS' } }),
  ]).counts.conflict, 0);
});
test('budgets explicitly mark missing coverage', () => {
  const deps = Object.fromEntries(Array.from({ length: 29 }, (_, i) => ['pkg-' + i, '^1.0.0']));
  const packages = Object.fromEntries(Array.from({ length: 29 }, (_, i) => ['node_modules/pkg-' + i, { version: '1.2.0' }]));
  const r = evaluate([json('package.json', { dependencies: deps }), json('package-lock.json', { packages })]);
  assert.equal(r.limited, true);
  assert.equal(r.decisions.length, 24);
  assert.equal(r.counts.satisfiable, 24);
  assert.match(r.limitations.join(' '), /absence of conflicts is not guaranteed/);
});
test('oversized input is not parsed as evidence', () => {
  const r = evaluate([file('package.json', 'x'.repeat(256 * 1024 + 1)), file('.nvmrc', '18')]);
  assert.equal(r.decisions.length, 0);
  assert.equal(r.limited, true);
});

test('UCE analyzeProject exposes symbolic conflicts and original file evidence in report notes', () => {
  const { analyzeProject } = load('src/lib/analyzer/analyzer.ts');
  const files = [
    json('package.json', { name: 'fixture', type: 'module', engines: { node: '>=22' },
      dependencies: { react: '^18.2.0' } }),
    file('.nvmrc', '20'),
    json('package-lock.json', { lockfileVersion: 3,
      packages: { 'node_modules/react': { version: '19.0.0' } } }),
    json('tsconfig.json', { compilerOptions: { module: 'CommonJS' } }),
    file('src/index.ts', 'export const value: string = "ok";'),
  ];
  const report = analyzeProject({
    fileName: 'symbolic-fixture', files, source: 'upload',
    scanStats: { projectSize: 1000, filesFound: files.length, filesAnalyzed: files.length,
      filesIgnored: 0, ignoredCategories: [] },
  });
  assert.equal(report.classification.isSoftware, true);
  assert.ok(report.stack.symbolicReasoning);
  assert.equal(report.stack.symbolicReasoning.counts.conflict, 3);
  assert.ok(report.notes.some(note => note.includes('Symbolic constraint reasoning: 3 evidenced conflict')));
  assert.ok(report.notes.some(note => note.includes('package-lock.json')));
  assert.ok(report.notes.some(note => note.includes('tsconfig.json')));
});
