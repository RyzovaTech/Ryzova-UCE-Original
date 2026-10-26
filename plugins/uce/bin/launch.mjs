#!/usr/bin/env node
// Local-only plugin entrypoint. No implicit access to $HOME or the filesystem.
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workspace = process.env.UCE_MCP_AUTHORIZED_ROOT;
if (!workspace || !path.isAbsolute(workspace)) {
  process.stderr.write('UCE MCP requires UCE_MCP_AUTHORIZED_ROOT as an explicit absolute directory.\n');
  process.exit(2);
}
try {
  if (!fs.statSync(workspace).isDirectory() || fs.lstatSync(workspace).isSymbolicLink()) {
    throw Error('unsafe');
  }
} catch {
  process.stderr.write('UCE MCP authorized root must be a non-symlink directory.\n');
  process.exit(2);
}
// The plugin is a thin MCP wrapper, not a fork of the canonical UCE engine.
// A repo checkout works directly; independently installed plugins must point
// at a complete, user-installed UCE checkout using an absolute UCE_ENGINE_ROOT.
const suppliedEngineRoot = process.env.UCE_ENGINE_ROOT;
if (suppliedEngineRoot && !path.isAbsolute(suppliedEngineRoot)) {
  process.stderr.write('UCE_ENGINE_ROOT must be an absolute path to a full UCE checkout.\n');
  process.exit(2);
}
const engineRoot = suppliedEngineRoot || fileURLToPath(new URL('../../..', import.meta.url));
const script = path.join(engineRoot, 'tools/mcp/server.mjs');
if (!fs.existsSync(script) || !fs.existsSync(path.join(engineRoot, 'package.json'))) {
  process.stderr.write('No canonical UCE engine found. Install UCE and set UCE_ENGINE_ROOT.\n');
  process.exit(2);
}
const child = spawn(process.execPath, [script, '--root=' + workspace], {
  shell: false, stdio: 'inherit', env: process.env, cwd: engineRoot,
});
child.on('error', () => process.exitCode = 1);
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { if (child.exitCode === null) child.kill(signal); });
}
