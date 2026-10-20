import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../../scripts/trusted-module-loader.mjs';

const { scanAstDetector } = load('src/lib/knowledge/v3-ast-adapter.ts');
const { executeV3RulePacks } = load('src/lib/knowledge/v3-sdk.ts');
const { V3_CORE_RULE_PACK } = load('src/lib/knowledge/v3-core-pack.ts');

const file = (path, content) => ({ path, size: Buffer.byteLength(content), isDirectory: false, content });
const detector = (query, names) => ({ kind: 'ast', query, names, languages: ['javascript', 'typescript'] });
const find = (path, source, query, names, limit = 100) => scanAstDetector(detector(query, names), file(path, source), limit);
const found = (path, source, query, names) => find(path, source, query, names).evidence.map(x => x.detail);

test('real assignment AST distinguishes writes from strings, comments, object keys and comparisons', () => {
  const positive = [
    'element.innerHTML = html;',
    "element['innerHTML'] = html;",
    'innerHTML = html;',
  ];
  for (const code of positive) assert.deepEqual(found('src/app.ts', code, 'assignment', ['innerHTML']), ['assignment:innerHTML']);
  for (const source of [
    '// element.innerHTML = html;\nconst safe = true;',
    'const text = "element.innerHTML = html;";',
    'const text = `element.innerHTML = html;`;',
    'const object = { innerHTML: html };',
    'element.innerHTML === html;',
    'element.innerHTML += html;',
    'const method = { innerHTML(value) {} };',
  ]) assert.deepEqual(found('src/app.ts', source, 'assignment', ['innerHTML']), [], source);
});

test('JSX and TSX attribute evidence uses real JSX nodes', () => {
  const source = 'const app = <main dangerouslySetInnerHTML={{ __html: content }} data-foo="safe" />;';
  assert.deepEqual(found('src/page.tsx', source, 'jsx-attribute', ['dangerouslySetInnerHTML']),
    ['jsx-attribute:dangerouslySetInnerHTML']);
  assert.deepEqual(found('src/page.jsx', source, 'jsx-attribute', ['data-foo']), ['jsx-attribute:data-foo']);
  assert.deepEqual(found('src/page.ts', 'const x = "dangerouslySetInnerHTML";', 'jsx-attribute', ['dangerouslySetInnerHTML']), []);
});

test('call detection is syntactic and checks exact property chains', () => {
  const source = [
    'document.write(message);',
    'const literal = "document.write(1)";',
    '// document.write(1);',
    'other.document.write(2);',
    'const demo = { write() {} };',
  ].join('\n');
  const results = find('src/entry.js', source, 'call', ['document.write']);
  assert.deepEqual(results.evidence.map(x => [x.detail, x.line]), [['call:document.write', 1]]);
  assert.deepEqual(found('src/entry.js', 'document["write"](message);', 'call', ['document.write']), ['call:document.write']);
  assert.deepEqual(found('src/entry.ts', 'const x = document.write;', 'call', ['document.write']), []);
});

test('imports include ES imports, re-exports, dynamic imports and literal require', () => {
  const source = [
    'import React from "react";',
    'export * from "react";',
    'const dynamic = import("react");',
    'const pkg = require("react");',
    'import(missing);',
    'const example = "require(\\\"react\\\")";',
  ].join('\n');
  assert.equal(found('src/app.ts', source, 'import', ['react']).length, 4);
  assert.deepEqual(found('src/app.ts', 'const text = "import React from react";', 'import', ['react']), []);
  assert.deepEqual(found('src/app.ts', 'require(variable);', 'import', ['react']), []);
});

test('declarations include TS-only constructs and skip prose', () => {
  const source = [
    'interface Service { run(): void }',
    'type Name = string;',
    'const active: boolean = true;',
    'class Worker {}',
    '// interface Service {}',
    'const s = "type Name = number";',
  ].join('\n');
  assert.deepEqual(new Set(found('src/service.ts', source, 'declaration', ['Service','Name','active','Worker'])),
    new Set(['declaration:Service','declaration:Name','declaration:active','declaration:Worker']));
});

test('unsupported, malformed and over-budget source never claims verified AST evidence', () => {
  assert.deepEqual(found('src/main.py', 'innerHTML = html', 'assignment', ['innerHTML']), []);
  assert.deepEqual(found('src/app.ts', 'const = ; innerHTML = html;', 'assignment', ['innerHTML']), []);
  assert.deepEqual(found('src/main.js', 'innerHTML = 1; // comment', 'assignment', ['innerHTML']), ['assignment:innerHTML']);
  const oversized = find('src/large.js', ' '.repeat(256 * 1024 + 1) + 'innerHTML=1', 'assignment', ['innerHTML']);
  assert.equal(oversized.truncated, true);
  assert.deepEqual(oversized.evidence, []);
});

test('AST result lines are exact and bounded by maxMatches', () => {
  const result = find('src/app.ts', '// hi\nconst a = 1;\nelement.innerHTML = a;\nelement.innerHTML = a;', 'assignment', ['innerHTML'], 1);
  assert.equal(result.evidence.length, 1);
  assert.ok([3, 4].includes(result.evidence[0].line));
  assert.equal(result.truncated, false);
});

test('V3 core AST rule no longer raises comment/string false positives', () => {
  const scan = source => executeV3RulePacks([V3_CORE_RULE_PACK], {
    files: [file('src/view.tsx', source)], technologies: ['javascript', 'typescript'],
  }).findings.filter(x => x.ruleId === 'code.web.inner-html-assignment');
  assert.equal(scan('/* el.innerHTML = value; */ const s = "el.innerHTML = value;";').length, 0);
  const result = scan('const View = () => <div />;\nel.innerHTML = value;');
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].evidence.map(x => x.detail), ['assignment:innerHTML']);
  assert.equal(result[0].line, 2);
});
