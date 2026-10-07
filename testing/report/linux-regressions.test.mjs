import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../../scripts/trusted-module-loader.mjs';
const { collectWorkspaceFindings } = load('src/lib/report/workspace.ts');
const { exportSarif } = load('src/lib/report/export.ts');
const { detectCodeIntelligence } = load('src/lib/analyzer/code-intelligence.ts');
const { finishBatchCoverage } = load('src/lib/analyzer/batch-coverage.ts');
const file = (path, content) => ({ path, content, size: Buffer.byteLength(content), isDirectory: false });
const issue = (id, affectedFile) => ({ id, affectedFile, title: 'Review', severity: 'warning', category: 'security', description: 'Evidence', reason: 'Review required', recommendation: 'Inspect context' });
function report() {
  const security = { id: 'pickle-one', ruleId: 'SEC015', file: 'tools/perf/viewer.py', line: 2727, title: 'Deserialization', severity: 'warning', evidence: 'pickle.loads(data)', recommendation: 'Review provenance' };
  const browser = { id: 'css-has', feature: ':has()', kind: 'css', status: 'unsupported', file: 'rust/rustdoc/style.css', line: 19, affectedBrowsers: ['Safari 14'], recommendation: 'Check documentation targets' };
  return { id: 'linux-regression', createdAt: '2026-10-07T00:00:00Z', analysisVersion: 'uce-3.0.0-beta.1', source: 'upload', score: { overall: 100 }, categories: [],
    summary: { name: 'Linux', scanStats: { filesFound: 10, filesAnalyzed: 2, ignoredCategories: [] }, analysisCoverage: {} },
    issues: [issue('batch-security:pickle-one', 'tools/perf/viewer.py:2727'), issue('batch-browser:rust/rustdoc/style.css:css-has:Safari 14', 'rust/rustdoc/style.css:19')],
    stack: { securityIntelligence: { findings: [security], score: 93, filesScanned: 8 }, browserCompatibility: { findings: [browser], score: 98, filesScanned: 1, defaultTargetsUsed: true } },
    notes: ['Security intelligence: 0 findings; static security score 100%.', 'Browser compatibility: not applicable to analyzed files; no browser source files checked.', 'Correlated intelligence: 1 prioritized cross-engine insight.', 'All deterministic compatibility checks passed. No compatibility action is required.'],
  };
}
test('batch mirrors export once with canonical rule and source region', () => {
  const sarif = JSON.parse(exportSarif(report())).runs[0].results;
  assert.equal(sarif.length, 2);
  assert.deepEqual(sarif.map(item => item.ruleId).sort(), ['SEC015', 'css-has']);
  const location = sarif.find(item => item.ruleId === 'SEC015').locations[0].physicalLocation;
  assert.equal(location.artifactLocation.uri, 'tools/perf/viewer.py');
  assert.equal(location.region.startLine, 2727);
});
test('orphan batch findings survive and legacy locations become separate lines', () => {
  const input = report(); input.stack = {};
  input.issues.push(issue('windows', 'C:\\src\\app.ts:42'), issue('drive', 'C:\\src\\42'));
  const findings = collectWorkspaceFindings(input);
  assert.equal(findings.length, 4);
  assert.equal(findings[0].line, 2727);
  assert.equal(findings[2].file, 'C:\\src\\app.ts');
  assert.equal(findings[2].line, 42);
  assert.equal(findings[3].file, 'C:\\src\\42');
});
test('final batch summaries use aggregated findings without inflating core readiness', () => {
  const input = report();
  finishBatchCoverage(input, { eligibleFiles: 10, nextIndex: 10, textFilesEligible: 10, filesWithContent: 8, unreadableTextFiles: 0, bytesRead: 800 }, 2, 200, { security: 0, browser: 0 }, { sampled: true, truncated: false });
  assert.ok(input.notes.includes('Security intelligence: 1 finding; static security score 93%.'));
  assert.ok(input.notes.includes('Browser compatibility: 1 compatibility finding; score 98%.'));
  assert.equal(input.notes.some(note => note.includes('No compatibility action is required')), false);
  assert.ok(input.stack.intelligenceInsights.some(item => item.id === 'browser-target-gaps'));
  assert.equal(input.summary.analysisCoverage.status, 'partial');
  assert.equal(input.score.overall, 100);
  finishBatchCoverage(input, { eligibleFiles: 10, nextIndex: 10, textFilesEligible: 10, filesWithContent: 8, unreadableTextFiles: 0, bytesRead: 800 }, 2, 200, { security: 0, browser: 0 }, { sampled: true, truncated: false });
  assert.equal(input.notes.filter(note => note.startsWith('Security intelligence:')).length, 1);
});
test('Rust documentation prose does not become a function; real fn preserves location', () => {
  const source = '/// within the task context that was active when this function was called.\nconst DOC: &str = "function fake() {}";\npub unsafe fn current() { inspect(); }';
  const result = detectCodeIntelligence([file('rust/kernel/task.rs', source)]);
  assert.deepEqual(result.symbols.map(item => item.name), ['current']);
  assert.equal(result.symbols[0].line, 3);
});
test('C definitions and Go receiver methods use language declarations', () => {
  const result = detectCodeIntelligence([file('kernel/task.c', '/* This function reserves memory. */\nstatic int reserve(int n) { return n; }\nint declaration(int n);'), file('src/task.go', '// function invented\nfunc (t *Task) Run() {}')]);
  assert.deepEqual(result.symbols.map(item => item.name), ['reserve', 'Run']);
});
test('JS comments and literal examples do not manufacture symbols, imports or calls', () => {
  const result = detectCodeIntelligence([file('src/app.js', '// function invented() {}\nconst docs = "function fake() { dangerous(); }";\n// import x from "./peer.js";\nimport peer from "./peer.js";\nfunction real() { /* hidden(); */ peer(); }'), file('src/peer.js', 'export function peer() {}')]);
  assert.deepEqual(result.symbols.map(item => item.name), ['real', 'peer']);
  assert.equal(result.dependencyEdges.length, 1);
  assert.equal(result.callRelationships.some(item => item.callee === 'hidden' || item.callee === 'dangerous'), false);
  assert.ok(result.callRelationships.some(item => item.callee === 'peer'));
});
