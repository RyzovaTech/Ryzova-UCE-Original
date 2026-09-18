#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'uce-benchmark-'));
const report = path.join(directory, 'report.json');
const start = performance.now();
const run = spawnSync(process.execPath, ['scripts/uce-scan.mjs', '.', `--output=${report}`, '--max-files=25000', `--max-bytes=${96 * 1024 * 1024}`], { encoding: 'utf8', timeout: 60_000 });
const elapsedMs = Math.round(performance.now() - start);
try { fs.rmSync(directory, { recursive: true, force: true }); } catch { /* OS cleanup fallback */ }
if (run.status !== 0) { console.error(run.stderr || run.stdout); process.exit(1); }
const budgetMs = Number(process.env.UCE_BENCHMARK_BUDGET_MS ?? 30_000);
console.log(JSON.stringify({ benchmark: 'repository-scan', elapsedMs, budgetMs, status: elapsedMs <= budgetMs ? 'passed' : 'failed' }));
if (elapsedMs > budgetMs) process.exit(1);
