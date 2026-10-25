#!/usr/bin/env node
/**
 * Phase 5.6B: publicly attributed, SHA-pinned real-repository manifest
 * EXCERPT evaluation. No third-party project scripts or packages execute.
 * This is structural/parity evidence, NOT human accuracy adjudication.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { load } from '../../scripts/trusted-module-loader.mjs';

const { analyzeProject } = load('src/lib/analyzer/analyzer.ts');
const { buildUnifiedBrowserReport } = load('src/lib/report/unified-intelligence.ts');
const { evaluateBrowserQuality } = load('src/lib/report/phase5-quality.ts');
const corpus = JSON.parse(fs.readFileSync(new URL('../release/manifest-corpus.json', import.meta.url), 'utf8'));
assert.equal(corpus.labelStatus, 'agent-provisional');
assert.equal(corpus.usedForTuning, false);
assert.ok(Array.isArray(corpus.projects) && corpus.projects.length === 8);
const seen = new Set();
const rows = [];
for (const sample of corpus.projects) {
  assert.match(sample.repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
  assert.match(sample.commit, /^[a-f0-9]{40}$/);
  assert.ok(!seen.has(sample.repository.toLowerCase()), 'duplicate real repository');
  seen.add(sample.repository.toLowerCase());
  const sourceFile = sample.files.find(file => file.path === sample.sourcePath);
  assert.ok(sourceFile);

  // The corpus sourceSha256 attests the FULL upstream source file. For
  // leading-sections and selected-manifest-fields we only retain excerpts;
  // their hashes must never be compared to the original full-file digest.
  assert.match(sample.sourceSha256, /^[a-f0-9]{64}$/, 'malformed upstream source digest');
  assert.ok(['full-file', 'leading-sections', 'selected-manifest-fields'].includes(sample.excerptKind),
    'unsupported excerpt boundary');
  const excerptSha256 = crypto.createHash('sha256').update(sourceFile.content).digest('hex');
  const upstreamDigestVerification = sample.excerptKind === 'full-file'
    ? 'matched-retained-full-file' : 'not-verified-from-excerpt';
  if (sample.excerptKind === 'full-file') {
    assert.equal(excerptSha256, sample.sourceSha256,
      'declared full-file excerpt must match its upstream SHA-256');
  }
  assert.equal(sample.sourceUrl,
    'https://github.com/' + sample.repository + '/blob/' + sample.commit + '/' + sample.sourcePath);
  const files = sample.files.map(file => ({
    path: file.path, content: file.content,
    size: Buffer.byteLength(file.content), isDirectory: false,
  }));
  const input = { fileName: sample.repository.replace('/', '__'), files,
    source: 'upload', scanStats: { projectSize: files.reduce((n,f) => n+f.size,0),
      filesFound: files.length, filesAnalyzed: files.length, filesIgnored: 0,
      ignoredCategories: [], sampled: true, truncated: true,
      truncationReason: 'Pinned manifest excerpts only; incomplete repository evidence' } };
  const inputBefore = JSON.stringify(input);
  const report = analyzeProject(input);
  const before = JSON.stringify(report);
  const unified = buildUnifiedBrowserReport(report);
  const quality = evaluateBrowserQuality(report, unified);
  assert.equal(JSON.stringify(report), before, 'browser interpretation mutated UCE scan');
  assert.equal(JSON.stringify(input), inputBefore, 'scan or enrichment changed pinned source evidence');
  assert.equal(quality.scoreParity, 'preserved');
  assert.equal(quality.originalIssueParity, 'preserved');
  assert.equal(quality.graphCoverage, 'unknown', 'manifest excerpts cannot establish full coverage');
  assert.equal(quality.accuracy.falsePositiveRate, null);
  assert.equal(quality.accuracy.falseMergeRate, null);
  assert.equal(quality.accuracy.recommendationCorrectness, null);
  assert.ok(unified.findings.every(f => f.verification === 'not-run'));
  assert.ok(unified.rootGroups.every(group =>
    group.findingIds.every(id => unified.findings.some(f => f.id === id))));
  assert.ok(Number.isFinite(report.score.overall));
  rows.push({
    repository: sample.repository, sourceCommit: sample.commit,
    sourcePath: sample.sourcePath, sourceSha256: sample.sourceSha256,
    excerptSha256, excerptKind: sample.excerptKind, upstreamDigestVerification,
    sourceScope: 'pinned-manifest-excerpt', ecosystem: sample.ecosystem,
    originalScore: report.score.overall,
    nativeIssues: report.issues.length, derivedFindings: unified.findings.length,
    groups: unified.rootGroups.length,
    reviewCandidates: quality.counts.candidatesTotal,
    scoreParity: quality.scoreParity, nativeIssueParity: quality.originalIssueParity,
    structuralStatus: quality.status, graphCoverage: quality.graphCoverage,
    symbolicVerification: quality.symbolic.solverVerification,
    structuralFlagCodes: [...new Set(quality.flags.map(f => f.code))],
  });
}
const result = {
  phase: '5.6B', sourceScope: 'eight curated SHA-pinned public manifest excerpts; NOT full repositories',
  repositoriesEvaluated: rows.length, humanReviewedProjects: 0,
  falsePositiveRate: null, falseMergeRate: null, recommendationCorrectness: null,
  sourceReview: 'not independently adjudicated',
  structuralScoreParity: rows.every(r => r.scoreParity === 'preserved'),
  structuralIssueParity: rows.every(r => r.nativeIssueParity === 'preserved'),
  limitations: [
    'Excerpt-only coverage; no full dependency graph or runtime compatibility proof',
    'For leading-sections/selected-manifest-fields, upstream full-file SHA-256 is declared but cannot be verified against a retained excerpt',
    'Human reviewer labels, blind accuracy metrics, and root-cause correctness not measured',
    'Trilogy labels use UCE-extracted context; native solver never invoked',
    'Repository selection is curated and not representative of arbitrary user projects',
  ], rows,
};
const output = process.env.UCE_PHASE56_OUTPUT;
if (output) {
  fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
  fs.writeFileSync(path.resolve(output),JSON.stringify(result,null,2)+'\n');
}
console.log(JSON.stringify({phase:result.phase,scope:result.sourceScope,
  scanned:rows.length,structuralScoreParity:result.structuralScoreParity,
  structuralIssueParity:result.structuralIssueParity,accuracy:'not-measured',
  nonPassStructural:rows.filter(r=>r.structuralStatus!=='passed-structural-checks')
    .map(r=>({repo:r.repository,codes:r.structuralFlagCodes}))}));
