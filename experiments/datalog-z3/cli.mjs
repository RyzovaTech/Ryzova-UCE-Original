#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { evaluateDatalogZ3 } from './hybrid.mjs';

// Explicit local fixture or project-file JSON only, never fetches anything or
// runs project source. Not used in production/browser.
try {
  const file = process.argv[2];
  if (!file) throw Error('Usage: node cli.mjs <local-project-files.json>');
  const contents = await readFile(file);
  if (contents.length > 256 * 1024) throw Error('Input file budget exceeded.');
  const data = JSON.parse(contents.toString('utf8'));
  if (!data || !Array.isArray(data.files)) throw Error('Expected {workspace?,files:[{path,content}]}');
  const result = await evaluateDatalogZ3(data.files, { workspace: data.workspace ?? '' });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.status === 'unknown') process.exitCode = 3;
} catch {
  process.stderr.write('Input unavailable, malformed or unsupported.\n');
  process.exitCode = 2;
}
