import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { terminateSolverProcessTree } from '../../solver-process-lifecycle.mjs';

test('POSIX isolated solver group termination stops a spawned descendant', {
  skip: process.platform !== 'linux',
}, async () => {
  const code = [
    'const {spawn}=require("node:child_process");',
    'const c=spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"});',
    'process.stdout.write(String(c.pid)+"\\n");',
    'setInterval(()=>{},1000);',
  ].join('');
  const parent = spawn(process.execPath, ['-e', code], {
    detached: true, shell: false, stdio: ['ignore', 'pipe', 'ignore'],
  });
  let grandchildPid;
  try {
    grandchildPid = await new Promise((resolve, reject) => {
      let text = '';
      parent.stdout.setEncoding('utf8');
      parent.stdout.on('data', chunk => {
        text += chunk;
        if (text.includes('\n')) {
          const pid = Number(text.split('\n')[0]);
          if (!Number.isInteger(pid) || pid <= 0) reject(new Error('no descendant pid'));
          else resolve(pid);
        }
      });
      parent.on('error', reject);
      parent.on('close', () => reject(new Error('parent exited before descendant spawned')));
    });
    terminateSolverProcessTree(parent);
    await new Promise((resolve, reject) => {
      if (parent.exitCode !== null || parent.signalCode !== null) return resolve();
      parent.once('close', resolve);
      parent.once('error', reject);
    });
    let state = null;
    for (let i = 0; i < 30; i++) {
      try {
        const data = await readFile('/proc/' + grandchildPid + '/stat', 'utf8');
        state = data.slice(data.lastIndexOf(')') + 2)[0];
      } catch (err) {
        if (err.code === 'ENOENT') { state = null; break; }
        throw err;
      }
      if (state === 'Z' || state === 'X') break;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert.ok(state === null || state === 'Z' || state === 'X', 'descendant still running after process-group termination');
  } finally {
    terminateSolverProcessTree(parent);
    if (Number.isInteger(grandchildPid)) {
      try { process.kill(grandchildPid, 'SIGKILL'); } catch { /* already gone */ }
    }
  }
});
