#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { analyzeProjectWithOptionalTrilogy } from './optional-integration.mjs';

// Explicit local JSON payload. No project source execution, network calls,
// browser imports or solver startup unless --trilogy is passed.
const file = process.argv[2];
if (!file || process.argv.slice(3).some(x => x !== '--trilogy' && x !== '--strict-resource-limits')) {
  console.error('Usage: node optional-cli.mjs <local-project-files.json> [--trilogy] [--strict-resource-limits]');
  process.exit(2);
}
try {
  const bytes = await readFile(file);
  if (bytes.length > 700 * 1024) throw Error('Input budget exceeded.');
  const data = JSON.parse(bytes.toString('utf8'));
  if (!data || !Array.isArray(data.files) || data.files.length > 32 ||
      data.files.some(f => !f || typeof f.path !== 'string' ||
        typeof f.content !== 'string' || f.content.length > 256 * 1024)) {
    throw Error('Invalid project file records.');
  }
  const files = data.files.map(f => ({
    path: f.path, content: f.content,
    isDirectory: false, size: Buffer.byteLength(f.content),
  }));
  const input = {
    fileName: data.fileName ?? 'trilogy-fixture',
    files, source: 'upload',
    scanStats: {
      projectSize: files.reduce((sum, f) => sum + f.size, 0),
      filesFound: files.length, filesAnalyzed: files.length,
      filesIgnored: 0, ignoredCategories: [],
    },
  };
  const report = await analyzeProjectWithOptionalTrilogy(input, {
    enableTrilogy: process.argv.includes('--trilogy'),
    strictResourceLimits: process.argv.includes('--strict-resource-limits'),
    workspace: data.workspace ?? '',
  });
  // Compact report excerpt; no copying of manifests or uploaded project data.
  const output = {
    analysisVersion: report.analysisVersion,
    projectType: report.classification.type,
    nativeScore: report.score.overall,
    nativeIssues: report.issues.length,
    nativeSymbolic: report.stack.symbolicReasoning?.counts ?? null,
    optionalSolver: report.optionalSolver,
  };
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
} catch {
  process.stderr.write('Input file malformed, unavailable, or over budget.\n');
  process.exitCode = 2;
}
