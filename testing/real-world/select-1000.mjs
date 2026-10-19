#!/usr/bin/env node
/**
 * Build a provenance-preserving list of 1000 NEW public repositories.
 * Selection excludes the previous 160, uses 20 separate search strata
 * and stores selection labels as weak metadata proxies, not ground truth.
 */
import fs from 'node:fs';
import path from 'node:path';

const initial = JSON.parse(fs.readFileSync(new URL('./repositories.json', import.meta.url), 'utf8'));
const excluded = new Set(initial.repositories.map((item) => item.repo.toLowerCase()));
const groups = [
  ['Python library', 'language:Python topic:python-library stars:>20 size:100..5000 fork:false archived:false'],
  ['Python general', 'language:Python stars:>80 size:150..5000 fork:false archived:false'],
  ['JavaScript library', 'language:JavaScript topic:nodejs stars:>40 size:100..5000 fork:false archived:false'],
  ['JavaScript general', 'language:JavaScript stars:>70 size:150..5000 fork:false archived:false'],
  ['TypeScript library', 'language:TypeScript topic:typescript stars:>40 size:100..5000 fork:false archived:false'],
  ['TypeScript general', 'language:TypeScript stars:>70 size:150..5000 fork:false archived:false'],
  ['Go', 'language:Go stars:>70 size:100..5000 fork:false archived:false'],
  ['Rust', 'language:Rust stars:>70 size:100..5000 fork:false archived:false'],
  ['Java', 'language:Java stars:>70 size:100..5000 fork:false archived:false'],
  ['PHP', 'language:PHP stars:>70 size:100..5000 fork:false archived:false'],
  ['Ruby', 'language:Ruby stars:>70 size:100..5000 fork:false archived:false'],
  ['C++', 'language:C++ stars:>70 size:100..5000 fork:false archived:false'],
  ['C#', 'language:C# stars:>70 size:100..5000 fork:false archived:false'],
  ['Kotlin', 'language:Kotlin stars:>70 size:100..5000 fork:false archived:false'],
  ['Swift', 'language:Swift stars:>70 size:100..5000 fork:false archived:false'],
  ['Dart', 'language:Dart stars:>70 size:100..5000 fork:false archived:false'],
  ['C', 'language:C stars:>70 size:100..5000 fork:false archived:false'],
  ['Elixir', 'language:Elixir stars:>40 size:100..5000 fork:false archived:false'],
  ['Scala', 'language:Scala stars:>40 size:100..5000 fork:false archived:false'],
  ['Lua', 'language:Lua stars:>40 size:100..5000 fork:false archived:false'],
];
const token = process.env.GITHUB_TOKEN;
if (!token) throw Error('GITHUB_TOKEN is required for authenticated repository discovery');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let lastRequest = 0;
async function search(query, page) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(Math.max(0, lastRequest + 2500 - Date.now()));
    lastRequest = Date.now();
    const url = 'https://api.github.com/search/repositories?' + new URLSearchParams({ q: query, per_page: '100', page: String(page), sort: 'stars', order: 'desc' });
    const response = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'User-Agent': 'uce-repository-audit' }, signal: AbortSignal.timeout(35000) });
    if (response.ok) return (await response.json()).items ?? [];
    if ((response.status === 403 || response.status === 429 || response.status >= 500) && attempt < 4) {
      const reset = Number(response.headers.get('x-ratelimit-reset') ?? 0);
      const delay = response.status === 403 && reset * 1000 > Date.now() ? Math.min(90000, reset * 1000 - Date.now() + 1500) : 12000 + 5000 * attempt;
      console.warn('Search retry', response.status, query, delay);
      await sleep(delay);
      continue;
    }
    throw Error('GitHub discovery failed: HTTP ' + response.status + ', ' + query);
  }
  throw Error('Search exhausted');
}
const skipName = /(?:^|[-_.])(?:awesome|roadmap|guides?|cheatsheets?|interview|tutorials?|list-of|resources|questions|exercises)(?:[-_.]|$)/i;
const rows = [];
const seen = new Set(excluded);
for (const [category, query] of groups) {
  let included = 0;
  for (let page = 1; page <= 4 && included < 50; page++) {
    const results = await search(query, page);
    for (const r of results) {
      if (included === 50) break;
      const name = r.full_name;
      if (typeof name !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(name) || seen.has(name.toLowerCase()) || r.archived || r.fork || r.private || (r.size ?? 0) > 5000 || skipName.test(r.name ?? '')) continue;
      seen.add(name.toLowerCase());
      included++;
      rows.push({ repo: name, githubCategory: category, githubPrimaryLanguageAtSelection: r.language ?? null, githubReportedSizeKB: r.size ?? null, defaultBranchAtSelection: r.default_branch ?? null, searchQuery: query });
    }
    if (results.length < 100) break;
  }
  console.log('Selected', category, included, '/ 50');
  if (included < 50) throw Error('Insufficient independent repositories for ' + category + ': ' + included + ' / 50');
}
if (rows.length !== 1000 || new Set(rows.map(r => r.repo.toLowerCase())).size !== 1000) throw Error('Not exactly 1000 unique repositories');
const out = path.resolve(process.env.UCE_BENCHMARK_SELECT_OUTPUT ?? 'benchmark-input');
fs.mkdirSync(out, { recursive: true });
const filename = path.join(out, 'repositories-1000.json');
fs.writeFileSync(filename, JSON.stringify({
  schemaVersion: 2, selectedAt: new Date().toISOString(), referenceSet: 'previous 160 excluded',
  description: 'Nonrandom, GitHub search-selected public repositories; metadata labels are observational only, not independently reviewed true identity.',
  categories: groups.map(([name]) => ({ name, count: 50 })),
  repositories: rows,
}, null, 2) + '\n');
console.log('UCE_1000_SELECTED=' + JSON.stringify({ count: rows.length, excludedPrevious: excluded.size, cohorts: groups.length, filename }));
