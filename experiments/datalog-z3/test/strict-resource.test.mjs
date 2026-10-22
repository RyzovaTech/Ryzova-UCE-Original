import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
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

test('delegated cgroup enforces OOM and reaps descendant process tree', {
  skip: process.platform !== 'linux' || !process.env.UCE_TRILOGY_TEST_CGROUP_PARENT,
  timeout: 15000,
}, async () => {
  const guard = await createStrictSolverCgroup({
    root: process.env.UCE_TRILOGY_TEST_CGROUP_PARENT, memoryMiB: 64,
  });
  assert.equal(guard.ok, true, guard.reason);
  const worker = spawn(process.execPath, ['-e', [
    'const {spawn}=require("node:child_process");',
    'process.stdin.once("data",()=>{',
    'const code="const b=[]; setInterval(()=>b.push(Buffer.alloc(8*1024*1024,1)),10);";',
    'spawn(process.execPath,["-e",code],{stdio:"ignore"});',
    'setInterval(()=>{},1000);',
    '});',
  ].join('')], {stdio:['pipe','ignore','ignore'],shell:false});
  let close;
  try {
    assert.equal(await guard.attach(worker.pid),true,'worker must join cgroup before stress starts');
    close = new Promise(resolve=>worker.once('close',resolve));
    worker.stdin.write('go\n');
    const timed = Promise.race([
      close.then(()=>true),
      new Promise(resolve=>setTimeout(()=>resolve(false),7000)),
    ]);
    const exited = await timed;
    assert.equal(exited,true,'kernel OOM group should terminate root worker and child');
  } finally {
    try { worker.kill('SIGKILL'); } catch {}
  }
  const cleaned = await guard.destroy();
  assert.equal(cleaned.verified,true,'kernel must prove no surviving descendants');
  assert.ok(cleaned.oomKills >= 1,'memory.events must report real kernel OOM kill');
});
