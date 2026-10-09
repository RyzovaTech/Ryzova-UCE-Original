import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { load } from '../../scripts/trusted-module-loader.mjs';
const { analyzeProject } = load('src/lib/analyzer/analyzer.ts');
const { readZip } = load('src/lib/analyzer/zip.ts');
const file = (path, content) => ({ path, content, size: Buffer.byteLength(content), isDirectory: false });
const scan = (files, source = 'upload') => analyzeProject({ files, source, fileName: 'library', scanStats: { projectSize: files.reduce((n, f) => n + f.size, 0), filesFound: files.length, filesAnalyzed: files.length, filesIgnored: 0, ignoredCategories: [] } });
const php = config => [file('composer.json', JSON.stringify({ name: 'demo/library', type: 'library', require: { php: '>=8.1' }, config })), file('src/App.php', '<?php class App {}')];
const platform = (path, content) => scan([file(path, content)]).stack.extendedIntelligence.modules.platform.findings;
test('Go help text is not a command execution but real Command and CommandContext calls remain reviewable', () => {
  assert.equal(platform('cobra.go', 'package cobra\nvar Help = `Open cmd.exe and run it from there.`').length, 0);
  for (const content of ['exec.Command("cmd.exe", "/c", input)', 'exec.CommandContext(ctx, "powershell.exe", input)']) assert.equal(platform('app.go', 'package main\nfunc main() { '+content+' }').length, 1);
});
test('PHP comment paths do not create platform findings; executable path literals retain original line numbers', () => {
  const comment = '<?php\n/** Rewrites Windows paths like "C:\\logs\\foo.rot". */\n';
  assert.equal(platform('src/Handler.php', comment + 'function normalize($path) { return $path; }').length, 0);
  const hits = platform('src/Handler.php', comment + '$file = fopen("C:\\logs\\real.log", "w");');
  assert.equal(hits.length, 1); assert.equal(hits[0].line, 3);
});
test('Composer root manifest counts as root configuration', () => {
  assert.equal(scan(php({})).issues.some(i => i.id === 'root-config-missing'), false);
  assert.equal(scan([file('src/App.php', '<?php class App {}')]).issues.some(i => i.id === 'root-config-missing'), true);
});
test('only an explicit boolean Composer lock opt-out suppresses the missing-lock finding', () => {
  assert.equal(scan(php({ lock: false })).issues.some(i => i.id === 'composer-lock-missing'), false);
  for (const config of [{}, { lock: true }, { lock: 'false' }]) assert.equal(scan(php(config)).issues.some(i => i.id === 'composer-lock-missing'), true);
});
test('PHPUnit distributed XML is extracted as text and contributes coverage configuration evidence', async () => {
  const xml = '<?xml version="1.0"?><phpunit><coverage/></phpunit>';
  const zip = new JSZip(); zip.file('project/phpunit.xml.dist', xml); zip.file('project/composer.json', JSON.stringify({name:'demo/library',require:{php:'>=8.1'}}));
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const input = Object.assign(bytes, { name: 'php.zip', size: bytes.length });
  const parsed = await readZip(input);
  assert.equal(parsed.files.find(f => f.path === 'phpunit.xml.dist').content, xml);
  assert.equal(scan(parsed.files).stack.extendedIntelligence.modules.testing.metrics.coverageReady, true);
});
test('commented, CDATA and fixture-only PHPUnit coverage are not project evidence', () => {
  for (const [path, content] of [['phpunit.xml.dist', '<phpunit><!-- <coverage/> --></phpunit>'], ['phpunit.xml', '<phpunit><![CDATA[<coverage/>]]></phpunit>'], ['test/fixtures/phpunit.xml.dist', '<phpunit><coverage/></phpunit>']]) {
    assert.equal(scan([...php({}), file(path, content)]).stack.extendedIntelligence.modules.testing.metrics.coverageReady, false);
  }
});
test('GitHub archive limitations distinguish archive absence from repository absence', () => {
  const files = php({});
  assert.ok(scan(files, 'github').trust.limitations.some(note => note.includes('export-ignore')));
  assert.equal(scan(files).trust.limitations.some(note => note.includes('export-ignore')), false);
});
