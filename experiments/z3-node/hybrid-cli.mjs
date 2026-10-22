#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { evaluateHybridNodeReasoning } from './hybrid.mjs';

// Explicit JSON-only project-file input. Never evaluate scanned project code.
// Run: node experiments/z3-node/hybrid-cli.mjs fixtures/hybrid-joint.json --z3
const file = process.argv[2];
if (!file || process.argv.slice(3).some(x => x !== '--z3')) {
  console.error('Usage: node hybrid-cli.mjs <project-files.json> [--z3]');
  process.exit(2);
}
try {
  const bytes = await readFile(file);
  if (bytes.length > 256 * 1024) throw Error('Input is too large');
  const data = JSON.parse(bytes.toString('utf8'));
  if (!Array.isArray(data.files) || data.files.length > 32 ||
      data.files.some(f => !f || typeof f.path !== 'string' || f.path.length > 160 ||
        typeof f.content !== 'string' || f.content.length > 64 * 1024)) {
    throw Error('Expected bounded { workspace?, files: [{path, content, isDirectory:false}] }');
  }
  const files = data.files.map(f => ({
    path: f.path, content: f.content, size: Buffer.byteLength(f.content), isDirectory: false,
  }));
  const result = await evaluateHybridNodeReasoning(files, {
    workspace: typeof data.workspace === 'string' ? data.workspace : '',
    enableZ3: process.argv.includes('--z3'),
  });
  // Emit a small stable summary; omit copied manifests and source data.
  const { base, ...rest } = result;
  console.log(JSON.stringify({ ...rest, baseCounts: base.counts }, null, 2));
} catch (error) {
  // JSON parse errors can quote user-supplied manifest contents; never echo them.
  console.error('Hybrid input invalid, over budget, or could not be processed.');
  process.exit(2);
}
