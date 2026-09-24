#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '../..');
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
function load(relative) {
  const full = path.resolve(root, relative);
  if (cache.has(full)) return cache.get(full).exports;
  const module = { exports: {} }; cache.set(full, module);
  if (full.endsWith('.json')) { module.exports = { default: JSON.parse(fs.readFileSync(full, 'utf8')) }; return module.exports; }
  const source = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', source)((name) => name.startsWith('.')
    ? load(path.resolve(path.dirname(full), name) + (path.extname(name) ? '' : '.ts')) : nativeRequire(name), module, module.exports);
  return module.exports;
}
const { V3_DEFAULT_RULE_PACKS } = load('src/lib/knowledge/v3-default-packs.ts');
const { executeV3RulePacks } = load('src/lib/knowledge/v3-sdk.ts');
const { prepareAnalysisInput } = load('src/lib/analyzer/execution.ts');
const file = (name, content) => ({ path: name, content, size: Buffer.byteLength(content), isDirectory: false });
const files = [
  file('package.json', JSON.stringify({ dependencies: { react: '18.3.1', vite: '5.0.0' } })),
  ...Array.from({ length: 240 }, (_, index) => file('src/module-' + index + '.ts', 'export const value' + index + ' = ' + index + ';\n')),
  ...Array.from({ length: 2_400 }, (_, index) => file('vendor/lib-' + index + '.js', 'export const vendor = 1;\n')),
];
const started = performance.now();
const prepared = prepareAnalysisInput({
  files, fileName: 'synthetic-large-monorepo', source: 'upload',
  scanStats: { projectSize: files.reduce((sum, item) => sum + item.size, 0), filesFound: files.length,
    filesAnalyzed: files.length, filesIgnored: 0, ignoredCategories: [] },
}, { maxFiles: 350, maxContentBytes: 8 * 1024 * 1024, maxSingleFileBytes: 1 * 1024 * 1024 });
assert.equal(prepared.input.scanStats.sampled, true);
assert.equal(prepared.input.scanStats.truncated, true);
assert.ok(prepared.input.files.length <= 350);
assert.ok(prepared.input.files.some(item => item.path === 'package.json'));
const result = executeV3RulePacks(V3_DEFAULT_RULE_PACKS, {
  files: prepared.input.files, technologies: ['typescript', 'javascript', 'react', 'vite', 'nodejs'],
});
assert.equal(result.rulesConsidered, 10_000);
const elapsedMs = Math.round(performance.now() - started);
const heapMiB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
const heapBudgetMiB = 384;
console.log(JSON.stringify({ benchmark: 'sampled-2641-file-v3-scan', scannedFiles: prepared.input.files.length,
  sampled: prepared.input.scanStats.sampled, truncated: prepared.input.scanStats.truncated,
  rules: result.rulesConsidered, elapsedMs, heapMiB, heapBudgetMiB,
  status: heapMiB <= heapBudgetMiB && elapsedMs <= 30_000 ? 'passed' : 'failed' }));
if (heapMiB > heapBudgetMiB || elapsedMs > 30_000) process.exitCode = 1;
