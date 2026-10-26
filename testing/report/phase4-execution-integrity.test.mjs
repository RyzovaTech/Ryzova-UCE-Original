import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../../scripts/trusted-module-loader.mjs';

const {
  ANALYSIS_CACHE_VERSION, prepareAnalysisInput, fingerprintAnalysisInput,
  diffAnalysisInputs, canCacheAnalysisInput, canCacheAnalysisResult, markExecution,
} = load('src/lib/analyzer/execution.ts');
const cache = load('src/lib/analyzer/cache.ts');
const file = (path, content, isDirectory = false) => ({
  path, content, size: Buffer.byteLength(content ?? ''), isDirectory,
});
const input = (files, scanStats = {}, fileName = 'sample') => ({
  files, fileName, source: 'upload',
  scanStats: { filesFound: files.filter(f => !f.isDirectory).length,
    filesAnalyzed: files.filter(f => !f.isDirectory).length,
    filesIgnored: 0, projectSize: files.reduce((n,f) => n + f.size, 0),
    ignoredCategories: [], ...scanStats },
});
const result = () => ({
  summary: { scanStats: { sampled: false, truncated: false },
    analysisCoverage: { status: 'full' } },
  stack: { v3RulePlatform: { metrics: [] } },
  trust: { execution: { worker: true, cached: false } },
  issues: [], score: { overall: 99 }, notes: ['Fixture report'],
});
function legacy32(input) {
  let hash = 2166136261;
  const update = value => {
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  };
  update('23|' + input.fileName + '|' + input.source + '|' +
    (input.scanStats.archiveIndexSignature ?? '') + '|');
  for (const f of input.files) {
    update(f.path + '\0' + f.size + '\0' + (f.isDirectory ? 1 : 0) + '\0');
    if (f.content !== undefined) update(f.content);
  }
  return hash >>> 0;
}

test('known equal-length legacy 32-bit collision is separated by new framed cache key', () => {
  const first = input([file('src/index.js', 'w0pqum4e')]);
  const second = input([file('src/index.js', '50dllqle')]);
  assert.equal(legacy32(first), legacy32(second), 'the old 32-bit algorithm actually collides');
  assert.equal(ANALYSIS_CACHE_VERSION, 24);
  assert.match(fingerprintAnalysisInput(first), /^uce24-[a-f0-9]{32}-1$/);
  assert.notEqual(fingerprintAnalysisInput(first), fingerprintAnalysisInput(second));
  assert.equal(fingerprintAnalysisInput(first), fingerprintAnalysisInput(first));
});

test('cache identity includes inventory, source presence, content, provenance and ignored scope', () => {
  const a = input([file('src/test.ts', '')]);
  const k = fingerprintAnalysisInput(a);
  assert.notEqual(k, fingerprintAnalysisInput(input([file('src/test.ts', undefined)])));
  assert.notEqual(k, fingerprintAnalysisInput(input([file('src/test.ts', 'a')])));
  assert.notEqual(k, fingerprintAnalysisInput(input([file('src/TEST.ts', '')])));
  assert.notEqual(k, fingerprintAnalysisInput(input(a.files, { filesFound: 999 })));
  assert.notEqual(k, fingerprintAnalysisInput(input(a.files, { archiveIndexSignature: 'different' })));
  assert.notEqual(k, fingerprintAnalysisInput(input(a.files, { ignoredCategories: ['vendor'] })));
  assert.notEqual(k, fingerprintAnalysisInput(input(a.files, {}, 'different-project')));
  assert.notEqual(k, fingerprintAnalysisInput({ ...a, source: 'github' }));
  const reversed = input([file('README.md', 'Notes'), ...a.files]);
  assert.equal(fingerprintAnalysisInput(reversed),
    fingerprintAnalysisInput({ ...reversed, files: [...reversed.files].reverse() }));
});

test('bounded selection and cache keys remain repeatable across directory and file input ordering', () => {
  const files = [file('src/module-1.ts', 'export const one = 1;'),
    file('src/module-2.ts', 'export const two = 2;'),
    file('README.md', 'Project'), file('src', undefined, true)];
  const opts = { maxFiles: 2, maxContentBytes: 64, maxSingleFileBytes: 40 };
  const one = prepareAnalysisInput(input(files), opts);
  const two = prepareAnalysisInput(input([...files].reverse()), opts);
  assert.deepEqual(one.input.files.map(f => f.path), two.input.files.map(f => f.path));
  assert.equal(one.cacheKey, two.cacheKey);
  assert.equal(one.input.scanStats.sampled, true);
  assert.equal(canCacheAnalysisInput(one.input), false);
  assert.equal(one.input.scanStats.truncated, true);
  assert.deepEqual(diffAnalysisInputs(input(files), input(files)).changed, []);
  assert.deepEqual(diffAnalysisInputs(input(files), input(
    [file('src/module-1.ts', 'export const one = 2;'), ...files.slice(1)])).changed,
    ['src/module-1.ts']);
});

test('partial result, rule failure, incomplete sweep and V3 limits cannot enter reusable cache', () => {
  const base = input([file('package.json', '{}')]);
  assert.equal(canCacheAnalysisInput(base), true);
  assert.equal(canCacheAnalysisResult(result()), true);
  for (const flags of [{ sampled: true }, { truncated: true },
    { findingsLimited: true }, { ruleFailures: [{ruleId:'x',category:'runtime',kind:'exception'}] }]) {
    assert.equal(canCacheAnalysisInput(input(base.files, flags)), false);
    const altered = result(); Object.assign(altered.summary.scanStats, flags);
    assert.equal(canCacheAnalysisResult(altered), false);
  }
  const cases = [
    r => { r.summary.analysisCoverage.status = 'partial'; },
    r => { r.stack.securityIntelligence = { truncated: true }; },
    r => { r.stack.v3RulePlatform.metrics = [{ truncated: true }]; },
    r => { r.stack.v3RulePlatform.archiveSweep = { complete: false, findingsOmitted: 0 }; },
    r => { r.stack.v3RulePlatform.archiveSweep = { complete: true, findingsOmitted: 4 }; },
  ];
  for (const change of cases) {
    const r = result(); change(r);
    assert.equal(canCacheAnalysisResult(r), false);
  }
});

test('execution metadata reports actual fallback, worker and cache paths without mutating report', () => {
  const original = result();
  const before = JSON.stringify(original);
  const fallback = markExecution(original, false, false);
  const worker = markExecution(original, false, true);
  const cached = markExecution(original, true, false);
  assert.deepEqual([fallback.trust.execution.worker, worker.trust.execution.worker,
    cached.trust.execution.worker], [false, true, false]);
  assert.equal(cached.trust.execution.cached, true);
  assert.equal(JSON.stringify(original), before);
});

test('memory and session cache evict stale entries and never retain oversized reports', () => {
  const real = globalThis.sessionStorage;
  const storage = new Map();
  globalThis.sessionStorage = {
    getItem: k => storage.has(k) ? storage.get(k) : null,
    setItem: (k,v) => { storage.set(k,String(v)); },
    removeItem: k => { storage.delete(k); },
  };
  try {
    cache.clearAnalysisCache();
    for (let i = 0; i < 5; i++) cache.saveCachedAnalysis('test-key-' + i, result());
    assert.ok(cache.loadCachedAnalysis('test-key-0'));
    cache.saveCachedAnalysis('test-key-5', result());
    assert.equal(cache.loadCachedAnalysis('test-key-1'), null, 'oldest persisted entry is evicted');
    assert.ok(cache.loadCachedAnalysis('test-key-0'), 'recent hot entry survives');
    assert.equal([...storage.keys()].filter(k => k.includes('analysis-cache:v1:test-key-')).length, 5);
    const huge = result();
    huge.notes = ['x'.repeat(4 * 1024 * 1024 + 1)];
    cache.saveCachedAnalysis('too-large', huge);
    assert.equal(cache.loadCachedAnalysis('too-large'), null, 'oversized report does not consume hot cache');
    cache.clearAnalysisCache();
    assert.equal([...storage.keys()].filter(k => k.includes('analysis-cache')).length, 0);
  } finally {
    cache.clearAnalysisCache();
    if (real === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = real;
  }
});
