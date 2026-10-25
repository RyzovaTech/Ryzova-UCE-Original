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
const script = fileURLToPath(new URL('../../../tools/mcp/server.mjs', import.meta.url));
const child = spawn(process.execPath, [script, '--root=' + workspace], {
  shell: false, stdio: 'inherit', env: process.env,
});
child.on('error', () => process.exitCode = 1);
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { if (child.exitCode === null) child.kill(signal); });
}
