#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createZ3Session, solveNodeConstraints } from './solver.mjs';

const inputPath = process.argv[2];
if (!inputPath || process.argv.length !== 3) {
  console.error('Usage: node cli.mjs /path/to/explicit-node-constraints.json');
  process.exitCode = 2;
} else {
  let session;
  try {
    const path = resolve(inputPath);
    const raw = await readFile(path, 'utf8');
    if (raw.length > 65536) throw new Error('Input exceeds 64 KiB limit.');
    const input = JSON.parse(raw);
    session = await createZ3Session();
    const result = await solveNodeConstraints(session, input);
    console.log(JSON.stringify({ workspace: input.workspace, ...result }, null, 2));
    if (result.status === 'unknown') process.exitCode = 3;
    // "conflict" is a valid computed analysis result, not a CLI execution failure.
  } catch (error) {
    console.error('Z3 PoC could not analyze the input: ' + String(error.message ?? error));
    process.exitCode = 2;
  } finally {
    if (session) await session.close();
  }
}
