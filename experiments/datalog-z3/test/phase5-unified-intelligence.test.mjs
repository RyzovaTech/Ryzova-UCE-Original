import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { buildUnifiedIntelligence } from '../phase5-intelligence.mjs';
import { generateReviewableFixProposal } from '../phase5-patch.mjs';

const file = (path, content) => ({ path, content, size: Buffer.byteLength(content), isDirectory: false });
const hash = value => createHash('sha256').update(value).digest('hex');
function fixture({ root = '>=20', installed = '>=22',
  pin = '20.0.0\n', pinName = '.nvmrc', modify } = {}) {
  const pkg = { name: 'phase5-demo', version: '1.0.0',
    engines: { node: root }, dependencies: { alpha: '^1.0.0' } };
  const lock = { lockfileVersion: 3, packages: {
    '': { name: 'phase5-demo', version: '1.0.0', dependencies: { alpha: '^1.0.0' } },
    'node_modules/alpha': { version: '1.1.0', engines: { node: installed } },
  } };
  modify?.(pkg, lock);
  return [file('package.json', JSON.stringify(pkg)),
    file('package-lock.json', JSON.stringify(lock)), file(pinName, pin)];
}
const uce = (...issues) => ({ score: { overall: 87 }, issues });
const request = (files, changes = {}) => ({
  action: 'generate-fix-proposal', targetFile: '.nvmrc',
  expectedSha256: hash(files.find(x => x.path === '.nvmrc')?.content ?? ''),
  targetVersion: '22.0.0', ...changes,
});

test('scan fuses original UCE findings with independent runtime pin discovery without mutation', () => {
  const files = fixture();
  const native = uce({ id: 'u1', category: 'runtime', title: 'Missing runtime pin compatibility',
    severity: 'critical', affectedFile: '.nvmrc', recommendation: 'Review runtime pin' });
  const initialReport = JSON.stringify(native);
  const initialFiles = JSON.stringify(files);
  const result = buildUnifiedIntelligence(native, files);
  assert.equal(result.status, 'ok');
  assert.equal(result.originalScore, 87);
  assert.equal(result.originalIssueCount, 1);
  assert.ok(result.findings.some(f => f.origin === 'UCE'));
  assert.ok(result.findings.some(f => f.origin === 'Trilogy' &&
    /pinned-runtime/.test(f.id) && f.verification === 'not-run'));
  assert.equal(result.rootCauses.length, 1);
  assert.ok(result.rootCauses[0].findingIds.length > 0);
  assert.equal(result.patchTargets.length, 1);
  assert.equal(result.patchTargets[0].sha256, hash('20.0.0\n'));
  assert.ok(!JSON.stringify(result).includes('"diff"'), 'scan must never create a diff');
  assert.equal(JSON.stringify(native), initialReport);
  assert.equal(JSON.stringify(files), initialFiles);
});

test('disjoint source requirements are evidence-backed, never falsely formal-verified', () => {
  const out = buildUnifiedIntelligence(uce(), fixture({ root: '20', installed: '>=22' }));
  const source = out.findings.find(f => f.id.startsWith('trilogy:node-ranges'));
  assert.ok(source);
  assert.equal(source.verification, 'not-run');
  assert.equal(source.evidenceLevel, 'source-backed-static-model');
  assert.deepEqual(source.evidenceRefs,
    ['package.json#engines.node', 'package-lock.json#packages']);
});

test('exact identity deduplicates a shared UCE/Trilogy finding with both origin labels', () => {
  const native = uce({ id: 'same', category: 'runtime',
    title: 'Declared Node runtime pin does not satisfy mandatory requirements',
    severity: 'warning', affectedFile: '.nvmrc', recommendation: 'Review pin',
    detected: '20.0.0', expected: '>=22' });
  const out = buildUnifiedIntelligence(native, fixture());
  const found = out.findings.filter(f => f.title === native.issues[0].title);
  assert.equal(found.length, 1);
  assert.equal(found[0].origin, 'Both');
  assert.deepEqual(found[0].origins, ['UCE', 'Trilogy']);
  assert.equal(found[0].severity, 'warning', 'never mutate UCE severity');
  assert.equal(found[0].verification, 'not-run');
  assert.ok(found[0].relatedTrilogyIds.length === 1);
});

test('same title and file without matching source claim is not falsely deduplicated', () => {
  const report = uce({ id: 'wording-only', category: 'runtime',
    title: 'Declared Node runtime pin does not satisfy mandatory requirements',
    severity: 'warning', affectedFile: '.nvmrc', recommendation: 'Check claim' });
  const out = buildUnifiedIntelligence(report, fixture());
  const found = out.findings.filter(f => f.title === report.issues[0].title);
  assert.equal(found.length, 2);
  assert.ok(found.every(f => f.origin !== 'Both'));
});

test('same issue title but different file is not deduplicated; baseline issues remain present', () => {
  const native = uce({ id: 'different', category: 'runtime',
    title: 'Declared Node runtime pin does not satisfy mandatory requirements',
    severity: 'info', affectedFile: 'package.json', recommendation: 'Review' });
  const out = buildUnifiedIntelligence(native, fixture());
  assert.equal(out.findings.filter(f => f.title === native.issues[0].title).length, 2);
  assert.ok(out.findings.some(f => f.origin === 'UCE'));
});

test('unsupported production peer/platform semantics abstain without dropping native issues', () => {
  for (const modify of [(pkg, lock) => { lock.packages['node_modules/alpha'].peerDependencies = { react: '^18' }; },
    (pkg, lock) => { lock.packages['node_modules/alpha'].os = ['linux']; },
    (pkg) => { pkg.workspaces = ['packages/*']; }]) {
    const report = uce({ id: 'legacy', title: 'Existing issue', severity: 'warning',
      category: 'dependencies', affectedFile: 'package.json', recommendation: 'Review' });
    const r = buildUnifiedIntelligence(report, fixture({ modify }));
    assert.equal(r.status, 'partial');
    assert.equal(r.graphStatus, 'unknown');
    assert.equal(r.findings.length, 1);
    assert.equal(r.findings[0].origin, 'UCE');
    assert.deepEqual(r.patchTargets, []);
  }
});

test('valid explicit request returns minimal non-mutating diff, risk and static-only validation', () => {
  const files = fixture();
  const before = JSON.stringify(files);
  const result = generateReviewableFixProposal(files, request(files));
  assert.equal(result.status, 'proposed', JSON.stringify(result));
  const p = result.proposal;
  assert.equal(p.targetFile, '.nvmrc');
  assert.equal(p.oldVersion, '20.0.0');
  assert.equal(p.newVersion, '22.0.0');
  assert.ok(p.diff.includes('-20.0.0\n+22.0.0\n'));
  assert.equal(p.sourceSha256, hash('20.0.0\n'));
  assert.equal(p.proposedSha256, hash('22.0.0\n'));
  assert.equal(p.verification.status, 'static-semver-check-only');
  assert.equal(p.verification.formalProof, false);
  assert.equal(p.verification.buildOrRuntimeTested, false);
  assert.equal(p.applySupported, false);
  assert.ok(p.risk.factors.length >= 2);
  assert.ok(p.validationPlan.length >= 2);
  assert.equal(JSON.stringify(files), before);
  assert.deepEqual(result, generateReviewableFixProposal(files, request(files)),
    'proposal must be reproducible');
});

test('developer request is mandatory, even when source evidence is sufficient', () => {
  const files = fixture();
  for (const r of [undefined, {}, { action: 'scan', ...request(files) },
    { ...request(files), action: 'auto-generate' }]) {
    // Intent is exclusively the explicit generate-fix-proposal action.
    if (r?.action === 'generate-fix-proposal') continue;
    assert.equal(generateReviewableFixProposal(files, r).status, 'not-requested');
  }
});

test('stale hash cannot emit a diff, even if all versions are otherwise eligible', () => {
  const files = fixture();
  const req = request(files);
  files[2].content = '20.1.0\n';
  const result = generateReviewableFixProposal(files, req);
  assert.equal(result.status, 'stale');
  assert.equal(result.proposal, null);
});

test('fail closed for wrong targets, vague semver, prereleases and missing hashes', () => {
  const files = fixture();
  const invalid = [
    { targetFile: '../.nvmrc' }, { targetFile: 'package.json' },
    { targetVersion: '22' }, { targetVersion: '^22.0.0' },
    { targetVersion: '22.0.0-rc.1' }, { targetVersion: '22.0.0+metadata' },
    { targetVersion: '18.0.0' }, { expectedSha256: '' },
  ];
  for (const data of invalid) {
    const result = generateReviewableFixProposal(files, request(files, data));
    assert.equal(result.proposal, null, JSON.stringify(data));
    assert.notEqual(result.status, 'proposed', JSON.stringify(data));
  }
});

test('root Node engine contradiction cannot be falsely repaired by changing a pin', () => {
  const files = fixture({ root: '20', installed: '>=22' });
  const result = generateReviewableFixProposal(files, request(files));
  assert.equal(result.status, 'blocked');
  assert.match(result.reason, /not-compatible/);
});

test('multiple pin files, dynamic pin syntax and unsupported graph never get a patch', () => {
  const both = [...fixture(), file('.node-version', '20.0.0\n')];
  assert.equal(generateReviewableFixProposal(both, request(both)).status, 'blocked');
  const dynamic = fixture({ pin: 'lts/*\n' });
  assert.equal(generateReviewableFixProposal(dynamic, request(dynamic)).status, 'blocked');
  const noGraph = fixture({ modify: (pkg) => { pkg.optionalDependencies = { beta: '^1' }; } });
  assert.equal(generateReviewableFixProposal(noGraph, request(noGraph)).status, 'blocked');
});

test('one-line .node-version preserves CRLF and indentation without touching other files', () => {
  const files = fixture({ pinName: '.node-version', pin: '  v20.0.0  \r\n' });
  const req = { action: 'generate-fix-proposal', targetFile: '.node-version',
    expectedSha256: hash('  v20.0.0  \r\n'), targetVersion: '22.0.0' };
  const output = generateReviewableFixProposal(files, req);
  assert.equal(output.status, 'proposed', JSON.stringify(output));
  assert.equal(output.proposal.proposedSha256, hash('  v22.0.0  \r\n'));
  assert.deepEqual(files.map(f => f.path), ['package.json', 'package-lock.json', '.node-version']);
});

test('no scanner/request can create a patch for an incomplete or over-budget model', () => {
  const files = fixture({ modify: (pkg, lock) => {
    for (let i = 0; i < 33; i++) {
      lock.packages['node_modules/alpha' + i] = { version: '1.0.0', engines: { node: '>=22' } };
    }
  } });
  // Unreachable lock entries do not create mandatory constraints.
  assert.equal(buildUnifiedIntelligence(uce(), files).status, 'ok');
  const tooLarge = [...files, ...Array.from({ length: 63 }, (_, i) => file('x' + i, ''))];
  assert.equal(buildUnifiedIntelligence(uce(), tooLarge).status, 'partial');
  assert.equal(generateReviewableFixProposal(tooLarge, request(files)).proposal, null);
});

test('local scan CLI invokes native UCE analysis but does not generate a patch or execute solvers', () => {
  const cli = new URL('../phase5-cli.mjs', import.meta.url);
  const input = new URL('../fixtures/optional-project.json', import.meta.url);
  const run = spawnSync(process.execPath, [cli.pathname, 'scan', input.pathname],
    { encoding: 'utf8', timeout: 20000, maxBuffer: 512 * 1024 });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.version, 1);
  assert.equal(result.graphStatus, 'ok');
  assert.ok(typeof result.originalScore === 'number');
  assert.ok(result.findings.some(f => f.origin === 'Trilogy'));
  assert.ok(!run.stdout.includes('"proposal":'));
  assert.ok(!run.stdout.includes('"diff":'));
});

test('local propose CLI without explicit request returns not-requested', () => {
  const cli = new URL('../phase5-cli.mjs', import.meta.url);
  const input = new URL('../fixtures/optional-project.json', import.meta.url);
  const run = spawnSync(process.execPath, [cli.pathname, 'propose', input.pathname],
    { encoding: 'utf8', timeout: 15000 });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).status, 'not-requested');
});

test('framework coverage emits source-backed context, not an invented compatibility warning', () => {
  const files = fixture({ modify: (pkg, lock) => {
    pkg.dependencies.react = '^18.0.0';
    lock.packages[''].dependencies.react = '^18.0.0';
    lock.packages['node_modules/react'] = { version: '18.3.1' };
  } });
  const out = buildUnifiedIntelligence(uce(), files);
  const framework = out.findings.find(f => f.id.startsWith('trilogy:framework-declaration:'));
  assert.equal(out.status, 'ok', out.reason);
  assert.ok(framework);
  assert.equal(framework.module, 'framework');
  assert.equal(framework.contextOnly, true);
  assert.equal(framework.severity, 'info');
  assert.equal(framework.verification, 'not-run');
  assert.ok(framework.evidenceRefs.includes('package.json#dependencies'));
  assert.equal(out.rootCauses.some(g => g.findingIds.includes(framework.id)), false);
});

test('unreachable/dev-only framework metadata does not create framework claims', () => {
  const files = fixture({ modify: (pkg, lock) => {
    pkg.devDependencies = { react: '^18.0.0' };
    lock.packages['node_modules/react'] = { version: '18.3.1', dev: true };
  } });
  assert.equal(buildUnifiedIntelligence(uce(), files).findings.some(f =>
    f.id.startsWith('trilogy:framework-declaration:')), false);
});


test('different canonical Node pin declarations are independently source-backed, not a verified runtime failure', () => {
  const files = [...fixture(), file('.node-version', '22.0.0\n')];
  const native = uce({ id: 'native-pin', category: 'runtime',
    title: 'Other runtime evidence', severity: 'info',
    affectedFile: '.nvmrc', recommendation: 'Review' });
  const before = JSON.stringify(files);
  const reportBefore = JSON.stringify(native);
  const out = buildUnifiedIntelligence(native, files);
  assert.equal(out.status, 'ok', out.reason);
  const finding = out.findings.find(f => f.id.startsWith('trilogy:conflicting-node-pins:'));
  assert.ok(finding, JSON.stringify(out.findings));
  assert.equal(finding.origin, 'Trilogy');
  assert.equal(finding.severity, 'warning');
  assert.equal(finding.verification, 'not-run');
  assert.equal(finding.evidenceLevel, 'source-backed-static-model');
  assert.deepEqual(new Set(finding.evidenceRefs), new Set(['.nvmrc', '.node-version']));
  assert.deepEqual(new Set(finding.declaredPins.map(p => p.version)), new Set(['20.0.0', '22.0.0']));
  assert.equal(out.originalScore, 87);
  assert.equal(out.originalIssueCount, 1);
  assert.deepEqual(out.patchTargets, [], 'ambiguous pin targets must never be offered for patching');
  assert.ok(!JSON.stringify(out).includes('"diff"'));
  assert.equal(JSON.stringify(files), before);
  assert.equal(JSON.stringify(native), reportBefore);
  const reversed = buildUnifiedIntelligence(native, [...files].reverse());
  assert.equal(reversed.findings.find(f => f.id.startsWith('trilogy:conflicting-node-pins:')).id,
    finding.id, 'source order must not affect finding identity');
});

test('same or nonliteral Node pins do not invent a contradictory declaration finding', () => {
  const same = [...fixture(), file('.node-version', 'v20.0.0\r\n')];
  const identical = buildUnifiedIntelligence(uce(), same);
  assert.equal(identical.status, 'ok');
  assert.ok(!identical.findings.some(f => f.id.startsWith('trilogy:conflicting-node-pins:')));
  assert.deepEqual(identical.patchTargets, [], 'two equal pins still block a single-file proposal');
  for (const value of ['lts/*\n', '^22.0.0\n', '22.0.0-rc.1\n', '22.0.0+metadata\n',
    '099.0.0\n', '22.0.0\ntrailing\n']) {
    const out = buildUnifiedIntelligence(uce(),
      [...fixture(), file('.node-version', value)]);
    assert.ok(!out.findings.some(f => f.id.startsWith('trilogy:conflicting-node-pins:')), value);
    assert.deepEqual(out.patchTargets, []);
  }
});

test('unsupported source graphs never claim independent pin relationship proof', () => {
  const files = [...fixture({
    modify: pkg => { pkg.workspaces = ['packages/*']; },
  }), file('.node-version', '22.0.0\n')];
  const out = buildUnifiedIntelligence(uce(), files);
  assert.equal(out.status, 'partial');
  assert.equal(out.graphStatus, 'unknown');
  assert.equal(out.findings.length, 0);
  assert.deepEqual(out.patchTargets, []);
});


test('CLI fusion refuses a native critical versus Trilogy warning severity disagreement', () => {
  const native = uce({ id: 'critical', category: 'runtime',
    title: 'Declared Node runtime pin does not satisfy mandatory requirements',
    severity: 'critical', affectedFile: '.nvmrc', recommendation: 'Review pin',
    detected: '20.0.0', expected: '>=22' });
  const reportBefore = JSON.stringify(native);
  const out = buildUnifiedIntelligence(native, fixture());
  const matches = out.findings.filter(f => f.title === native.issues[0].title);
  assert.equal(matches.length, 2);
  assert.deepEqual(new Set(matches.map(f => f.severity)), new Set(['critical', 'warning']));
  assert.deepEqual(new Set(matches.map(f => f.origin)), new Set(['UCE', 'Trilogy']));
  assert.ok(matches.every(f => f.verification === 'not-run'));
  assert.equal(out.originalScore, 87);
  assert.equal(JSON.stringify(native), reportBefore);
});

test('CLI fusion leaves all identical native records independent when matching is ambiguous', () => {
  const data = { category: 'runtime',
    title: 'Declared Node runtime pin does not satisfy mandatory requirements',
    severity: 'warning', affectedFile: '.nvmrc', recommendation: 'Review pin',
    detected: '20.0.0', expected: '>=22' };
  const native = uce({ ...data, id: 'first' }, { ...data, id: 'second' });
  const before = JSON.stringify(native);
  const out = buildUnifiedIntelligence(native, fixture());
  const matches = out.findings.filter(f => f.title === data.title);
  assert.equal(matches.length, 3);
  assert.equal(matches.filter(f => f.origin === 'UCE').length, 2);
  assert.equal(matches.filter(f => f.origin === 'Trilogy').length, 1);
  assert.equal(out.originalIssueCount, 2);
  assert.equal(out.originalScore, 87);
  assert.deepEqual(matches.filter(f => f.origin === 'UCE').map(f => f.sourceIssueIds[0]),
    ['first', 'second']);
  assert.equal(JSON.stringify(native), before);
});