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
const largeFiles = process.env.UCE_BENCH_SOURCE_FILES ? Number(process.env.UCE_BENCH_SOURCE_FILES) : 0;
if (largeFiles && (!Number.isInteger(largeFiles) || largeFiles < 1 || largeFiles > 50_000)) throw new Error('UCE_BENCH_SOURCE_FILES must be an integer from 1 to 50,000.');
const files = [
  file('package.json', JSON.stringify({ dependencies: { react: '18.3.1', vite: '5.0.0' } })),
  ...Array.from({ length: largeFiles || 240 }, (_, index) => file('src/module-' + index + (largeFiles ? '.c' : '.ts'), largeFiles ? 'int module(void) { return 0; }\n' : 'export const value' + index + ' = ' + index + ';\n')),
  ...Array.from({ length: largeFiles ? 0 : 2_400 }, (_, index) => file('vendor/lib-' + index + '.js', 'export const vendor = 1;\n')),
];
const started = performance.now();
const prepared = prepareAnalysisInput({
  files, fileName: 'synthetic-large-monorepo', source: 'upload',
  scanStats: { projectSize: files.reduce((sum, item) => sum + item.size, 0), filesFound: files.length,
    filesAnalyzed: files.length, filesIgnored: 0, ignoredCategories: [] },
}, { maxFiles: largeFiles || 350, maxContentBytes: largeFiles ? 16 * 1024 * 1024 : 8 * 1024 * 1024, maxSingleFileBytes: 1 * 1024 * 1024 });
assert.equal(prepared.input.scanStats.sampled, true);
assert.equal(prepared.input.scanStats.truncated, true);
assert.ok(prepared.input.files.length <= (largeFiles || 350));
assert.ok(prepared.input.files.some(item => item.path === 'package.json'));
const result = executeV3RulePacks(V3_DEFAULT_RULE_PACKS, {
  files: prepared.input.files, technologies: largeFiles ? ['c', 'linux'] : ['typescript', 'javascript', 'react', 'vite', 'nodejs'],
});
assert.equal(result.rulesConsidered, 10_000);
const elapsedMs = Math.round(performance.now() - started);
const heapMiB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
const heapBudgetMiB = largeFiles ? 450 : 384;
const timeBudgetMs = largeFiles ? 120_000 : 30_000;
console.log(JSON.stringify({ benchmark: largeFiles ? 'linux-like-native-source' : 'sampled-2641-file-v3-scan', scannedFiles: prepared.input.files.length,
  sampled: prepared.input.scanStats.sampled, truncated: prepared.input.scanStats.truncated,
  rules: result.rulesConsidered, elapsedMs, heapMiB, heapBudgetMiB, timeBudgetMs,
  status: heapMiB <= heapBudgetMiB && elapsedMs <= timeBudgetMs ? 'passed' : 'failed' }));
if (heapMiB > heapBudgetMiB || elapsedMs > timeBudgetMs) process.exitCode = 1;
