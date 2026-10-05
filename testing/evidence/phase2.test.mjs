import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../../scripts/trusted-module-loader.mjs';
const { detectRegisteredTechnologies } = load('src/lib/analyzer/technology-registry.ts');
const { javascriptImportEvidence } = load('src/lib/analyzer/javascript-import-evidence.ts');
const { hasFlutterSdk, hasDotnetSdk } = load('src/lib/analyzer/declaration-evidence.ts');
const file = (path, content) => ({ path, content, size: Buffer.byteLength(content), isDirectory: false });
const manifest = (path, value) => file(path, JSON.stringify(value));
const detect = files => detectRegisteredTechnologies(files);
const get = (files, name) => detect(files).find(row => row.name === name);

test('framework package identity requires valid structured name and version', () => {
  const d = get([manifest('packages/kit/package.json', { name: '@sveltejs/kit', version: '3.0.0-next.1' })], 'SvelteKit');
  assert.equal(d.level, 'likely'); assert.equal(d.evidence[0].kind, 'manifest');
  for (const data of [{ name: '@sveltejs/kit' }, { name: '@sveltejs/kit', version: 3 }, { description: '@sveltejs/kit', version: '3.0.0' }])
    assert.equal(get([manifest('package.json', data)], 'SvelteKit'), undefined);
  for (const path of ['vendor/package.json', 'tests/package.json', 'docs/package.json', 'dist/package.json', 'examples/package.json'])
    assert.equal(get([manifest(path, { name: '@sveltejs/kit', version: '3.0.0' })], 'SvelteKit'), undefined);
});
test('invalid npm dependency values and arrays cannot establish a stack', () => {
  for (const value of [{ react: false }, { react: {} }, { react: null }, { react: 18 }, { react: '' }, ['react']])
    assert.equal(get([manifest('package.json', { dependencies: value })], 'React'), undefined);
  assert.equal(get([file('package.json', '{invalid')], 'React'), undefined);
});
test('.NET SDK identity is structural, not a filename or prose keyword', () => {
  assert.ok(get([manifest('global.json', { sdk: { version: '9.0.100' } })], '.NET'));
  for (const value of [{ description: '.NET SDK 9.0.100' }, { sdk: [] }, { sdk: { version: 'latest' } }, { sdk: { version: 9 } }])
    assert.equal(get([manifest('global.json', value)], '.NET'), undefined);
  assert.equal(hasDotnetSdk('{invalid'), false);
});
test('Flutter requires a declared SDK mapping, including framework-owned dependency blocks', () => {
  assert.equal(hasFlutterSdk('name: flutter\ndescription: flutter: framework\n'), false);
  assert.equal(hasFlutterSdk('dependencies:\n  sky_engine:\n    sdk: flutter\n'), true);
  assert.equal(hasFlutterSdk('dev_dependencies:\n  flutter_test:\n    sdk: flutter\n'), true);
  for (const text of ['# flutter:\n', 'description: "flutter:"\n', 'dependencies:\n  flutter: false\n', 'environment:\n  sdk: flutter\n', 'dependencies:\n  foo: 1\nother:\n  sdk: flutter\n'])
    assert.equal(hasFlutterSdk(text), false);
});
test('structured ecosystem readers ignore prose and comments but retain declarations', () => {
  for (const [path, content, technology] of [
    ['Cargo.toml', '[package]\nname="app"\n# axum="0.7"\n', 'Axum'],
    ['go.mod', 'module example.com/app\n// require github.com/gin-gonic/gin v1.0.0\n', 'Gin'],
    ['composer.json', '{"description":"laravel/framework"}', 'Laravel'],
    ['requirements.txt', '# django==5.1\n', 'Django'],
    ['pyproject.toml', '[project]\ndescription="django"\n', 'Django'],
  ]) assert.equal(get([file(path, content)], technology), undefined);
  assert.ok(get([file('Cargo.toml', '[dependencies]\nhttp={package="axum",version="0.7"}\n')], 'Axum'));
  assert.ok(get([file('go.mod', 'module example.com/app\nrequire github.com/gin-gonic/gin v1.10.0\n')], 'Gin'));
});
test('JavaScript AST evidence includes imports, reexports and literal dynamic imports', () => {
  for (const source of ['import React from "react";', 'export {createElement} from "react";', 'export * from "react/jsx-runtime";', 'const React = await import("react");']) {
    const d = get([file('src/app.js', source)], 'React');
    assert.equal(d.level, 'possible'); assert.equal(d.evidence[0].kind, 'import');
  }
  assert.deepEqual(javascriptImportEvidence([file('app.js', 'import R from "react"; import X from "react/jsx-runtime";')]).map(row => row.name), ['react']);
});
test('AST evidence rejects comments, strings, regexes, expressions, local paths and invalid syntax', () => {
  for (const source of ['// import R from "react";', 'const s = `import R from "react";`;', 'const s = \'import R from "react";\';', 'const re = /import("react")/;', 'import(name);', 'import("./react");', 'import("reactive");', 'import R from "react"; invalid !!!'])
    assert.equal(get([file('app.js', source)], 'React'), undefined);
  assert.equal(get([file('app.ts', 'import R from "react";')], 'React'), undefined);
  assert.equal(get([file('vendor/app.js', 'import R from "react";')], 'React'), undefined);
  assert.deepEqual(javascriptImportEvidence([file('app.js', ' '.repeat(256 * 1024) + 'import R from "react";')]), []);
});
test('lockfiles corroborate only declarations and matching root ranges in the same package', () => {
  const pkg = manifest('packages/web/package.json', { dependencies: { react: '^18.0.0' } });
  const lock = path => manifest(path, { lockfileVersion: 3, packages: { '': { dependencies: { react: '^18.0.0' } }, 'node_modules/react': { version: '18.3.1' } } });
  const d = get([pkg, lock('packages/web/package-lock.json')], 'React');
  assert.equal(d.evidence.some(row => row.source.endsWith('package-lock.json')), true);
  assert.equal(get([lock('package-lock.json')], 'React'), undefined);
  assert.equal(get([pkg, lock('packages/other/package-lock.json')], 'React').confidence, 55);
  const stale = lock('packages/web/package-lock.json'); stale.content = stale.content.replace('^18.0.0', '^17.0.0');
  assert.equal(get([pkg, stale], 'React').confidence, 55);
});
test('cross-package signals cannot inflate confidence while same-package evidence can corroborate', () => {
  const pkg = manifest('packages/web/package.json', { dependencies: { react: '^18.0.0' } });
  const other = manifest('packages/other/package.json', { name: 'other', version: '1.0.0' });
  const code = path => file(path, 'import R from "react";');
  assert.equal(get([pkg, other, code('packages/other/src/app.js')], 'React').confidence, 55);
  assert.equal(get([pkg, code('packages/web/src/app.js')], 'React').confidence, 75);
  assert.equal(get([pkg, pkg], 'React').confidence, 55);
});

test('multiline TOML descriptions cannot impersonate package identities', () => {
  assert.equal(get([file('pyproject.toml', '[project]\nname="app"\ndescription="""\n[project]\nname="Django"\n"""\n')], 'Django'), undefined);
  assert.equal(get([file('Cargo.toml', '[package]\nname="app"\ndescription="""\n[package]\nname="axum"\n"""\n')], 'Axum'), undefined);
});

test('V3 Go dependency evidence reads require directives and excludes module names and comments', () => {
  const { dependenciesFrom } = load('src/lib/knowledge/v3-sdk.ts');
  const path = 'go.mod';
  assert.equal(dependenciesFrom(file(path, 'module github.com/gin-gonic/gin\n// require fake/pkg v1.0.0\n')).size, 0);
  const entries = dependenciesFrom(file(path, 'module example.com/app\nrequire github.com/gin-gonic/gin v1.10.0\nrequire (\n github.com/labstack/echo/v4 v4.0.0 // indirect\n)\n'));
  assert.equal(entries.get('github.com/gin-gonic/gin'), 'v1.10.0');
  assert.equal(entries.get('github.com/labstack/echo/v4'), 'v4.0.0');
  assert.equal(entries.has('require'), false);
});

test('an exact locked version disagreement does not strengthen declaration confidence', () => {
  const pkg = manifest('package.json', { dependencies: { react: '18.3.1' } });
  const lock = manifest('package-lock.json', { packages: { '': { dependencies: { react: '18.3.1' } }, 'node_modules/react': { version: '17.0.0' } } });
  assert.equal(get([pkg, lock], 'React').confidence, 55);
});
