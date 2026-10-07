import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../../scripts/trusted-module-loader.mjs';
const { analyzeProject } = load('src/lib/analyzer/analyzer.ts');
const { executeV3RulePacks } = load('src/lib/knowledge/v3-sdk.ts');
const { V3_DEFAULT_RULE_PACKS } = load('src/lib/knowledge/v3-default-packs.ts');
const { maskRustTestModules } = load('src/lib/analyzer/rust-evidence.ts');
const file = (path, content) => ({ path, content, size: Buffer.byteLength(content), isDirectory: false });
const scan = files => analyzeProject({ files, fileName: 'regression', source: 'upload', scanStats: { projectSize: files.reduce((sum, f) => sum + f.size, 0), filesFound: files.length, filesAnalyzed: files.length, filesIgnored: 0, ignoredCategories: [] } });
const js = extra => [file('package.json', JSON.stringify({ name: 'library', version: '1.0.0', ...extra })), file('lib/app.js', 'module.exports = function () {};')];
const has = (report, id) => report.issues.some(item => item.id === id);

test('ESLint YAML and inline configuration are recognized; fixtures cannot supply project configuration', () => {
  for (const name of ['.eslintrc.yml', '.eslintrc.yaml', 'eslint.config.cts']) assert.equal(has(scan([...js(), file(name, 'root: true')]), 'eslint-config-missing'), false);
  assert.equal(has(scan(js({ eslintConfig: {} })), 'eslint-config-missing'), false);
  assert.equal(has(scan([...js(), file('test/fixtures/.eslintrc.yml', 'root: true')]), 'eslint-config-missing'), true);
  assert.equal(has(scan(js()), 'eslint-config-missing'), true);
});
test('default index.js satisfies only its own package entry point', () => {
  assert.equal(has(scan([...js(), file('index.js', 'module.exports = {};')]), 'pkg-entry-point-missing'), false);
  assert.equal(has(scan([...js(), file('other/index.js', 'module.exports = {};')]), 'pkg-entry-point-missing'), true);
  assert.equal(has(scan(js()), 'pkg-entry-point-missing'), true);
});
test('standard multiline Apache license is recognized; unrelated 2.0 prose is not', () => {
  assert.equal(has(scan([file('LICENSE', 'Apache License\nVersion 2.0, January 2004\nTERMS AND CONDITIONS'), file('app.py', 'print(1)')]), 'license-unrecognized'), false);
  assert.equal(has(scan([file('LICENSE', 'Apache License mentioned as an alternative.\nOur custom agreement version is 2.0.'), file('app.py', 'print(1)')]), 'license-unrecognized'), true);
});
test('nyc/c8 script invocations establish coverage; documentation strings do not', () => {
  for (const command of ['nyc --reporter=text npm test', 'npx c8 node test.js', 'npm run prepare && nyc mocha']) {
    const r = scan([...js({ scripts: { 'test-cov': command } }), file('test/app.js', 'it("works", () => {});')]);
    assert.equal(r.stack.extendedIntelligence.modules.testing.metrics.coverageReady, true);
  }
  const r = scan([...js({ description: 'nyc is available', scripts: { test: 'echo nyc' } }), file('test/app.js', 'it("works", () => {});')]);
  assert.equal(r.stack.extendedIntelligence.modules.testing.metrics.coverageReady, false);
});
test('HTML performance advice excludes fixtures and documentation but retains production checks', () => {
  const r = scan([file('test/fixtures/blog/index.html', '<html></html>'), file('docs/_templates/sidebar.html', '<nav></nav>'), file('public/index.html', '<html></html>')]);
  const hits = r.issues.filter(item => item.id.startsWith('no-prefetch-'));
  assert.deepEqual(hits.map(item => item.affectedFile), ['public/index.html']);
});
test('path-based inventory records one evidence per file without exhausting a character budget', () => {
  const selected = V3_DEFAULT_RULE_PACKS.map(pack => ({ ...pack, rules: pack.rules.filter(rule => ['technology.catalog.github-actions', 'technology.catalog.pm2-dependabot'].includes(rule.id)) })).filter(pack => pack.rules.length);
  const r = executeV3RulePacks(selected, { technologies: ['github-actions', 'pm2-dependabot'], files: [file('.github/workflows/ci.yml', 'name: CI\n' + '# long comment\n'.repeat(100)), file('.github/dependabot.yml', 'version: 2\n' + '# long comment\n'.repeat(100))] });
  assert.equal(r.findings.length, 2);
  assert.ok(r.metrics.every(item => item.matches === 1 && !item.truncated));
});
test('Rust inline test modules do not become production platform warnings', () => {
  const source = '#[cfg(test)]\nmod tests {\n #[test]\n fn windows_path() { let p = r"C:\\dir\\file.txt"; let braces = "}"; }\n}\nfn production() { let p = "/tmp/cache"; }';
  const masked = maskRustTestModules(source);
  assert.equal(masked.length, source.length);
  assert.equal(masked.split('\n').length, source.split('\n').length);
  assert.equal(masked.includes('C:'), false);
  assert.ok(masked.includes('/tmp/cache'));
  const r = scan([file('src/lib.rs', source), file('Cargo.toml', '[package]\nname="demo"\nversion="0.1.0"')]);
  const hits = r.stack.extendedIntelligence.modules.platform.findings;
  assert.equal(hits.length, 1); assert.equal(hits[0].line, 6);
});
test('Rust production modules, prose declarations and incomplete syntax are not discarded', () => {
  for (const source of ['mod tests { fn work() {} }', '// #[cfg(test)]\nmod production { fn work() {} }', '#[cfg(test)] mod tests {']) assert.equal(maskRustTestModules(source), source);
});
