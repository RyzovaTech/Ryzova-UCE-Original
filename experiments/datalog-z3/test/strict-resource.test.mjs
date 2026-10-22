import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStrictSolverCgroup } from '../../solver-linux-cgroup.mjs';
import { analyzeProjectWithOptionalTrilogy } from '../optional-integration.mjs';

const data = JSON.parse(await readFile(new URL('../fixtures/conflict.json', import.meta.url), 'utf8'));
function input() {
  const files = data.files.map(f => ({
    ...f, isDirectory: false, size: Buffer.byteLength(f.content),
  }));
  files.push({ path: 'src/index.ts', content: 'export const ready=true;', size: 25,
    isDirectory: false });
  return { fileName: 'strict-isolation-fixture', files, source: 'upload',
    scanStats: { projectSize: 1500, filesFound: files.length,
      filesAnalyzed: files.length, filesIgnored: 0, ignoredCategories: [] } };
}
test('reject a fake kernel cgroup on an ordinary filesystem', async () => {
  const r = await createStrictSolverCgroup({ root: '/tmp', memoryMiB: 512 });
  assert.equal(r.ok, false);
  assert.match(r.reason, /strict-platform-unsupported|cgroup-root-outside-kernel-mount/);
});
test('reject invalid cgroup paths and impossible memory budgets', async () => {
  assert.equal((await createStrictSolverCgroup({root: '../outside', memoryMiB: 512})).ok,false);
  assert.equal((await createStrictSolverCgroup({root: '/sys/fs/cgroup', memoryMiB: 0})).ok,false);
});
test('strict mode fails closed without delegated memory controls and retains UCE results', async () => {
  const plain = await analyzeProjectWithOptionalTrilogy(input());
  const r = await analyzeProjectWithOptionalTrilogy(input(), {
    enableTrilogy: true, strictResourceLimits: true,
    cgroupRoot: '/nonexistent/delegated-uce-cgroup',
  });
  assert.equal(r.optionalSolver.status, 'unknown');
  assert.match(r.optionalSolver.reason, /cgroup|strict-|hard-/);
  assert.equal(r.optionalSolver.hardIsolation,'unavailable');
  assert.deepEqual(r.issues, plain.issues);
  assert.deepEqual(r.score, plain.score);
  assert.deepEqual(r.stack.symbolicReasoning, plain.stack.symbolicReasoning);
});
test('strict isolation is opt-in and default path remains disabled', async () => {
  const r = await analyzeProjectWithOptionalTrilogy(input());
  assert.equal(r.optionalSolver.status,'disabled');
  assert.equal(r.optionalSolver.attempted,false);
  assert.equal(r.optionalSolver.hardIsolation,'not-requested');
});
test('strict mode can be exercised when an independently delegated cgroup exists', {
  skip: process.platform !== 'linux' || !process.env.UCE_TRILOGY_TEST_CGROUP_PARENT,
}, async () => {
  const r = await analyzeProjectWithOptionalTrilogy(input(),{
    enableTrilogy:true, strictResourceLimits:true,
    cgroupRoot:process.env.UCE_TRILOGY_TEST_CGROUP_PARENT,
  });
  assert.equal(r.optionalSolver.hardIsolation,'enforced',JSON.stringify(r.optionalSolver));
  assert.equal(r.optionalSolver.status,'conflict',JSON.stringify(r.optionalSolver));
  assert.ok(Number.isFinite(r.optionalSolver.hardTreePeakMiB));
  assert.equal(r.optionalSolver.hardOomKills,0);
});
