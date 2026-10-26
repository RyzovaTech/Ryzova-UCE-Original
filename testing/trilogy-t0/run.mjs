#!/usr/bin/env node
/** Deterministic, bounded T0 baseline; does not execute analyzed project code. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { load } from '../../scripts/trusted-module-loader.mjs';
import { evaluateDeveloperSafety, canonicalEvidenceHash } from './safety.mjs';

const { analyzeProject } = load('src/lib/analyzer/analyzer.ts');
const digest = text => createHash('sha256').update(text).digest('hex');
const root = new URL('../../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const existingBaseline = JSON.parse(read('testing/accuracy/baseline.json'));
const originalCorpus = read('testing/accuracy/corpus.json');
const corpusSha256 = digest(originalCorpus);
assert.equal(corpusSha256, existingBaseline.corpusSha256, 'Existing baseline corpus SHA changed; freeze and re-review before recording T0');
assert.equal(existingBaseline.globalAccuracy, null, 'Previous baseline unexpectedly claims global accuracy');
assert.equal(existingBaseline.humanReviewedCases, 0, 'Review the independently human-labelled protocol before changing T0 claims');
assert.ok(Array.isArray(existingBaseline.results) && existingBaseline.results.length >= 200,
  'Prior bounded corpus unexpectedly lost coverage');
const fixtures = [
  { id: 'typescript-source-scope', name: 't0-ts', files: [
    ['package.json', '{"name":"t0-typescript","version":"1.0.0","scripts":{"build":"tsc"}}'],
    ['tsconfig.json', '{"compilerOptions":{"target":"ES2022"}}'],
    ['src/index.ts', 'export const answer: number = 42;'],
  ]},
  { id: 'python-source-scope', name: 't0-python', files: [
    ['pyproject.toml', '[project]\nname = "t0-python"\nversion = "0.1.0"\nrequires-python = ">=3.11"\n'],
    ['src/main.py', 'def answer():\n    return 42\n'],
  ]},
  { id: 'browser-source-scope', name: 't0-browser', files: [
    ['index.html', '<!doctype html><html><head><title>T0</title></head><body><script src="src/app.js"></script></body></html>'],
    ['src/app.js', 'document.querySelector("body").dataset.ready = "true";'],
    ['src/style.css', 'body { display: grid; }'],
  ]},
];
function input(item) {
  const files = item.files.map(([path, content]) => ({
    path, content, isDirectory: false, size: Buffer.byteLength(content),
  }));
  return { fileName: item.name, source: 'upload', files, scanStats: {
    projectSize: files.reduce((sum, f) => sum + f.size, 0),
    filesFound: files.length, filesAnalyzed: files.length,
    filesIgnored: 0, ignoredCategories: [],
  }};
}
export function buildT0Baseline() {
  const rows = fixtures.map(item => {
    const data = input(item);
    const first = analyzeProject(data), second = analyzeProject(data);
    const firstHash = canonicalEvidenceHash(first);
    assert.equal(firstHash, canonicalEvidenceHash(second),
      'Same source produces differing canonical evidence: ' + item.id);
    const before = JSON.stringify(first);
    const safety = evaluateDeveloperSafety(first, data.files.map(f => f.path));
    assert.equal(JSON.stringify(first), before, 'Safety evaluation mutated original report');
    assert.equal(safety.rawCanonicalScore, first.score.overall, 'Score drift');
    assert.equal(safety.rawIssueCount, first.issues.length, 'Lost issue records');
    assert.equal(safety.independentAccuracy.globalAccuracy, null);
    assert.equal(safety.automaticFixesAllowed, false);
    return {
      fixture: item.id, sourceSha256: digest(JSON.stringify(item.files)),
      canonicalEvidenceSha256: firstHash, deterministicRepeat: true,
      categoryCount: first.categories.length, originalIssueCount: first.issues.length,
      assessment: safety,
    };
  });
  return {
    schemaVersion: 1, suite: 'trilogy-t0-accuracy-safety-baseline',
    engineVersion: existingBaseline.engineVersion,
    source: 'authored-static-contract-fixtures',
    existingBoundedCorpus: {
      name: existingBaseline.benchmark, sha256: corpusSha256,
      cases: existingBaseline.results.length,
      humanReviewedCases: existingBaseline.humanReviewedCases,
      sourceScope: existingBaseline.scope,
    },
    suiteAccuracy: {
      status: 'not-measured-needs-independent-blinded-labels',
      globalAccuracy: null, precision: null, recall: null,
      falsePositiveRate: null, falseNegativeRate: null,
      recommendationCorrectness: null, humanAdjudicatedCases: 0,
    },
    fixtures: rows,
    releaseReady: false,
    blockers: [
      'Independent blinded real-repository adjudication (Issue #80)',
      'Solver full process-tree hard isolation (Issue #77)',
      'Kernel-backed performance acceptance (Issue #81)',
      'No live runtime/build verification of static results',
    ],
    productionScoringOrRuleChanges: false,
    nativeTrilogyExecuted: false,
  };
}
const output = buildT0Baseline();
const arg = process.argv.find(a => a.startsWith('--output='));
if (arg) fs.writeFileSync(arg.slice('--output='.length), JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
