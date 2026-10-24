#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { load } from '../../scripts/trusted-module-loader.mjs';
import { buildUnifiedIntelligence } from './phase5-intelligence.mjs';
import { evaluatePhase5Intelligence } from './phase5-evaluation.mjs';
import { generateReviewableFixProposal } from './phase5-patch.mjs';

// Three explicit modes: scan, evaluate, and developer-requested propose.
// Evaluate audits a fresh read-only scan without generating patches. No mode
// mutates project bytes, executes project code, or starts a native solver.
const [mode, inputPath, ...rest] = process.argv.slice(2);
if (!['scan', 'evaluate', 'propose'].includes(mode) || !inputPath || rest.length) {
  process.stderr.write('Usage: node phase5-cli.mjs scan|evaluate|propose <local-project-json>\n');
  process.exitCode = 2;
} else {
  try {
    const raw = await readFile(inputPath);
    if (raw.length > 2500 * 1024) throw Error('budget');
    const data = JSON.parse(raw.toString('utf8'));
    if (!data || !Array.isArray(data.files) || data.files.length > 64 ||
        typeof data.workspace !== 'undefined' && typeof data.workspace !== 'string' ||
        data.files.some(f => !f || typeof f.path !== 'string' ||
          typeof f.content !== 'string' || f.content.length > 1024 * 1024)) {
      throw Error('shape');
    }
    const files = data.files.map(f => ({
      path: f.path, content: f.content, size: Buffer.byteLength(f.content),
      isDirectory: false,
    }));
    let result;
    if (mode === 'scan' || mode === 'evaluate') {
      const { analyzeProject } = load('src/lib/analyzer/analyzer.ts');
      const report = analyzeProject({
        fileName: typeof data.fileName === 'string' ? data.fileName.slice(0, 100) : 'phase5-project',
        files, source: 'upload',
        scanStats: {
          projectSize: files.reduce((n, f) => n + f.size, 0),
          filesFound: files.length, filesAnalyzed: files.length,
          filesIgnored: 0, ignoredCategories: [],
        },
      });
      const unified = buildUnifiedIntelligence(report, files, { workspace: data.workspace ?? '' });
      result = mode === 'evaluate' ? evaluatePhase5Intelligence(report, unified) : unified;
    } else {
      result = generateReviewableFixProposal(files, data.request, {
        workspace: data.workspace ?? '',
      });
    }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch {
    process.stderr.write('Input unavailable, malformed or over the bounded local file budget.\n');
    process.exitCode = 2;
  }
}
