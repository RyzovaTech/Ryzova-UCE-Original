import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const z3Cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
const hybridCli = fileURLToPath(new URL('../hybrid-cli.mjs', import.meta.url));
const SENTINEL = 'UCE_PRIVATE_SOURCE_SENTINEL_NEVER_LOG';
const malformed = '{"files":[' + JSON.stringify(SENTINEL) + ',';

function runCli(script, file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, file], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', part => { stdout += part; });
    child.stderr.on('data', part => { stderr += part; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

test('malformed local constraint JSON is not reflected in Z3 CLI stderr', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'uce-cli-redact-'));
  try {
    const file = join(dir, 'private.json');
    await writeFile(file, malformed);
    const result = await runCli(z3Cli, file);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /could not analyze/i);
    assert.ok(!result.stderr.includes(SENTINEL));
    assert.ok(!result.stdout.includes(SENTINEL));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('malformed local project JSON is not reflected in hybrid CLI output', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'uce-hybrid-redact-'));
  try {
    const file = join(dir, 'private.json');
    await writeFile(file, malformed);
    const result = await runCli(hybridCli, file);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /invalid/i);
    assert.ok(!result.stderr.includes(SENTINEL));
    assert.ok(!result.stdout.includes(SENTINEL));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
