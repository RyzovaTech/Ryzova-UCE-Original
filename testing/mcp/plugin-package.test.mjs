import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const folder = path.join(root, 'plugins/uce');
test('plugin manifest describes MPL-2.0 open-source UCE and valid local components', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(folder, '.codex-plugin/plugin.json'), 'utf8'));
  assert.equal(manifest.name, 'ryzova-uce');
  assert.equal(manifest.license, 'MPL-2.0');
  assert.equal(manifest.mcpServers, './.mcp.json');
  assert.equal(manifest.skills, './skills/');
  assert.equal(manifest.apps, undefined, 'never invent an unregistered ChatGPT app ID');
  const servers = JSON.parse(fs.readFileSync(path.join(folder, '.mcp.json'), 'utf8'));
  assert.deepEqual(servers.mcp_servers['ryzova-uce'].args, ['./plugins/uce/bin/launch.mjs']);
  assert.ok(fs.existsSync(path.join(folder, 'skills/analyze-repository/SKILL.md')));
});
test('local plugin denies implicit roots and symlink roots', () => {
  const script = path.join(folder, 'bin/launch.mjs');
  const forbidden = spawnSync(process.execPath, [script], {
    cwd:root,encoding:'utf8',env:{...process.env,UCE_MCP_AUTHORIZED_ROOT:''},timeout:5000
  });
  assert.equal(forbidden.status, 2);
  assert.equal(forbidden.stdout, '');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uce-plugin-'));
  try {
    const shortcut = path.join(dir, 'link');
    fs.symlinkSync(dir, shortcut);
    const denied = spawnSync(process.execPath, [script], {
      cwd:root,encoding:'utf8',env:{...process.env,UCE_MCP_AUTHORIZED_ROOT:shortcut},timeout:5000
    });
    assert.equal(denied.status, 2);
    assert.equal(denied.stdout, '');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
