#!/usr/bin/env node
/**
 * Bounded observational UCE CLI benchmark on public repositories.
 * No project code is executed. Only UCE's own trusted CLI is executed.
 * GitHub Linguist primary-language labels are an external, imperfect proxy,
 * not independent human ground truth or a global accuracy claim.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const corpus = JSON.parse(fs.readFileSync(new URL('./repositories.json', import.meta.url), 'utf8'));
const shard = Number(process.env.UCE_BENCHMARK_SHARD ?? '0');
const shards = Number(process.env.UCE_BENCHMARK_SHARDS ?? '4');
const maxRepos = Number(process.env.UCE_BENCHMARK_MAX_REPOS ?? '160');
if (!Number.isInteger(shard) || !Number.isInteger(shards) || shards < 1 || shard < 0 || shard >= shards || maxRepos < 1) throw Error('Invalid shard configuration');
const outputDir = path.resolve(process.env.UCE_BENCHMARK_OUTPUT ?? 'benchmark-output');
fs.mkdirSync(outputDir, { recursive: true });
const all = corpus.repositories.slice(0, maxRepos);
const cases = all.filter((_, index) => index % shards === shard);
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'uce-realworld-'));
const results = [];
const matchableLanguages = new Set(['Python', 'JavaScript', 'TypeScript', 'Go', 'Rust', 'PHP', 'Ruby', 'Java', 'Kotlin', 'C', 'C++', 'C#', 'Swift', 'Dart', 'Scala', 'Elixir', 'Erlang', 'Lua', 'Haskell', 'R', 'HTML', 'CSS', 'Shell', 'Solidity']);
const rootManagerFiles = new Map([
  ['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['bun.lock', 'bun'], ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'], ['uv.lock', 'uv'], ['poetry.lock', 'poetry'], ['pdm.lock', 'pdm'],
  ['Pipfile.lock', 'pipenv'], ['Cargo.toml', 'cargo'], ['go.mod', 'go-modules'],
  ['composer.json', 'composer'], ['Gemfile', 'bundler'], ['mix.exs', 'mix'],
  ['pubspec.yaml', 'pub'], ['pom.xml', 'maven'], ['build.gradle', 'gradle'],
  ['build.gradle.kts', 'gradle'], ['Package.swift', 'swift-package'],
]);
const frontConfig = new Map([
  ['next.config.', 'Next.js'], ['nuxt.config.', 'Nuxt'], ['astro.config.', 'Astro'],
  ['angular.json', 'Angular'], ['svelte.config.', 'Svelte'], ['remix.config.', 'Remix'],
]);
function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', timeout: options.timeout ?? 90000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], ...options });
}
async function githubMetadata(name) {
  const token = process.env.GITHUB_TOKEN;
  try {
    const response = await fetch('https://api.github.com/repos/' + name, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'ryzova-uce-realworld-benchmark', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return { error: 'http-' + response.status };
    const data = await response.json();
    return { primaryLanguage: data.language ?? null, archived: Boolean(data.archived), defaultBranch: data.default_branch ?? null, license: data.license?.spdx_id ?? null };
  } catch (error) { return { error: error?.name ?? 'network-error' }; }
}
function managerLabel(directory) {
  const matches = [];
  for (const [name, manager] of rootManagerFiles) if (fs.existsSync(path.join(directory, name))) matches.push(manager);
  const unique = [...new Set(matches)];
  // npm package manifests without a lock are not sufficient evidence that npm is the manager.
  if (unique.length === 1) return { value: unique[0], evidence: matches, status: 'single-marker' };
  return { value: null, evidence: matches, status: unique.length ? 'ambiguous-multiple-markers' : 'unlabeled' };
}
function frameworkLabel(directory) {
  const roots = fs.readdirSync(directory, { withFileTypes: true }).filter(x => x.isFile()).map(x => x.name);
  const found = [...new Set(roots.flatMap(filename => [...frontConfig].filter(([prefix]) => prefix.endsWith('.') ? filename.startsWith(prefix) : filename === prefix).map(([, f]) => f)))];
  return { value: found.length === 1 ? found[0] : null, evidence: roots.filter(x => [...frontConfig.keys()].some(prefix => prefix.endsWith('.') ? x.startsWith(prefix) : x === prefix)), status: found.length === 1 ? 'single-marker' : found.length ? 'ambiguous-multiple-markers' : 'unlabeled' };
}
function pair(expected, actual) {
  return expected === null || expected === undefined ? null : { expected, actual: actual ?? 'Unknown', agreement: expected === actual };
}
function outcomeCounts(rows, key) {
  const measured = rows.filter(r => r.status === 'scanned' && r[key] !== null);
  const matched = measured.filter(r => r[key].agreement).length;
  return { compared: measured.length, matched, mismatched: measured.length - matched, agreementPercent: measured.length ? Math.round(matched / measured.length * 10000) / 100 : null };
}
try {
  for (let i = 0; i < cases.length; i++) {
    const item = cases[i], name = item.repo;
    const row = { repo: name, searchCategory: item.githubCategory, status: 'unattempted', sourceCommit: null, githubLanguage: null, classification: null, filesFound: null, filesAnalyzed: null, limitedCoverage: null, language: null, manager: null, framework: null, observedScore: null };
    const directory = path.join(sandbox, 'repository');
    const reportFile = path.join(sandbox, 'uce-report.json');
    try {
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name)) throw Error('invalid-repository-name');
      const metadata = await githubMetadata(name);
      row.githubLanguage = metadata.primaryLanguage ?? null;
      row.githubMetadataError = metadata.error ?? null;
      const cloned = run('git', ['-c', 'advice.detachedHead=false', 'clone', '-q', '--depth=1', '--single-branch', '--no-tags', 'https://github.com/' + name + '.git', directory], { timeout: 90000 });
      if (cloned.status !== 0) throw Error('clone:' + (cloned.error?.code ?? String(cloned.stderr).trim().slice(-220) ?? cloned.status));
      row.sourceCommit = run('git', ['-C', directory, 'rev-parse', 'HEAD'], { timeout: 5000 }).stdout.trim();
      const markerManager = managerLabel(directory);
      const markerFramework = frameworkLabel(directory);
      const scan = run('node', ['--max-old-space-size=1024', 'scripts/uce-scan.mjs', directory, '--output=' + reportFile, '--max-files=4000', '--max-bytes=16777216'], { timeout: 180000 });
      if (scan.status !== 0) throw Error('scan:' + (scan.error?.code ?? String(scan.stderr).trim().slice(-280) ?? scan.status));
      const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
      row.status = 'scanned';
      row.classification = report.classification?.type ?? null;
      row.filesFound = report.summary?.scanStats?.filesFound ?? null;
      row.filesAnalyzed = report.summary?.scanStats?.filesAnalyzed ?? null;
      row.limitedCoverage = report.summary?.analysisCoverage?.status === 'partial' || Boolean(report.summary?.scanStats?.truncated);
      row.observedScore = report.score?.overall ?? null;
      const gitLanguage = row.githubLanguage === 'Shell' ? 'Bash' : row.githubLanguage;
      const eligibleLanguage = gitLanguage && (matchableLanguages.has(row.githubLanguage) || row.githubLanguage === 'Shell') ? gitLanguage : null;
      row.language = pair(eligibleLanguage, report.stack?.language);
      row.manager = pair(markerManager.value, report.stack?.packageManager);
      row.managerEvidence = markerManager.evidence;
      row.framework = pair(markerFramework.value, report.stack?.framework);
      row.frameworkEvidence = markerFramework.evidence;
      row.resultingLanguage = report.stack?.language ?? null;
      row.resultingFramework = report.stack?.framework ?? null;
      row.resultingManager = report.stack?.packageManager ?? null;
    } catch (error) {
      row.status = 'failed';
      row.error = String(error.message ?? error).slice(0, 360);
    } finally {
      results.push(row);
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 2 });
      fs.rmSync(reportFile, { force: true });
    }
    console.log(`[${shard}] ${i + 1}/${cases.length} ${row.status}: ${name} lang=${row.language?.agreement ?? '?'} manager=${row.manager?.agreement ?? '?'} framework=${row.framework?.agreement ?? '?'}`);
  }
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}
const summary = {
  schemaVersion: 1, shard, shards, totalSelected: all.length, attempted: results.length,
  scanned: results.filter(r => r.status === 'scanned').length, failed: results.filter(r => r.status === 'failed').length,
  completeScanCoverage: results.filter(r => r.status === 'scanned' && !r.limitedCoverage).length,
  language: outcomeCounts(results, 'language'), manager: outcomeCounts(results, 'manager'), framework: outcomeCounts(results, 'framework'),
  note: 'Observational agreement with GitHub primary-language metadata and explicit root markers; not independently adjudicated, not general UCE accuracy.',
};
const payload = { summary, results };
fs.writeFileSync(path.join(outputDir, `shard-${shard}.json`), JSON.stringify(payload, null, 2) + '\n');
console.log('UCE_REALWORLD_SUMMARY=' + JSON.stringify(summary));
console.log('UCE_REALWORLD_MISMATCHES=' + JSON.stringify(results.filter(r => [r.language, r.manager, r.framework].some(x => x && !x.agreement)).slice(0, 35).map(r => ({ repo: r.repo, sha: r.sourceCommit, language: r.language, manager: r.manager, framework: r.framework, limitedCoverage: r.limitedCoverage }))));
if (summary.scanned === 0) process.exitCode = 2;
