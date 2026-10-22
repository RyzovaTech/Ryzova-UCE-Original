#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { evaluateDatalogZ3 } from './hybrid.mjs';
import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('./fixtures/conflict.json', import.meta.url), 'utf8'));
const mem = () => Math.round(process.memoryUsage().rss / 1024 / 1024 * 10) / 10;
const rssBefore = mem();
const results = [];
for (let i = 0; i < 3; i++) {
  const t0 = performance.now();
  const result = await evaluateDatalogZ3(data.files, { workspace: data.workspace });
  const ms = Math.round((performance.now() - t0) * 100) / 100;
  if (result.status !== 'conflict' || result.paths.length < 2) {
    throw Error('Datalog+Z3 proof benchmark correctness failure: ' + result.status);
  }
  results.push(ms);
}
console.log(JSON.stringify({
  suite: 'souffle-z3-stacked-poc',
  iterations: results.length, totalSolveMs: results,
  meanSolveMs: Math.round(results.reduce((a,b)=>a+b,0)/results.length*100)/100,
  rssBeforeMiB: rssBefore, rssAfterMiB: mem(),
  note: 'Three-run whole Node process diagnostic; includes native Souffle process and Z3 WASM startup. Not a peak RSS, browser or accuracy measurement.',
},null,2));
