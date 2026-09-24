#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { syntaxWitness } from './v3-fixture-samples.mjs';

// Only trusted repository modules are transpiled; scanned fixture text is never executed.
const root = path.resolve(import.meta.dirname, '../..');
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
function load(relative) {
  const full = path.resolve(root, relative);
  if (cache.has(full)) return cache.get(full).exports;
  const module = { exports: {} }; cache.set(full, module);
  if (full.endsWith('.json')) { module.exports = { default: JSON.parse(fs.readFileSync(full, 'utf8')) }; return module.exports; }
  const compiled = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', compiled)((name) => name.startsWith('.')
    ? load(path.resolve(path.dirname(full), name) + (path.extname(name) ? '' : '.ts')) : nativeRequire(name), module, module.exports);
  return module.exports;
}
const { V3_DEFAULT_RULE_PACKS } = load('src/lib/knowledge/v3-default-packs.ts');
const { executeV3RulePacks } = load('src/lib/knowledge/v3-sdk.ts');
const { BROWSER_FEATURES } = load('src/lib/analyzer/browser-knowledge.ts');
const rules = V3_DEFAULT_RULE_PACKS.flatMap(pack => pack.rules);
const file = (name, content) => ({ path: name, content, size: Buffer.byteLength(content), isDirectory: false });
const samples = [
  'latest', '1.2.3', '0.2.0', '1.2.3-rc.1', 'nightly', 'snapshot', 'git+https://example.test/repo.git#main',
  'github:example/repo#main', 'file:../shared', '*', '1.2.x', 'TODO', 'npm:example@latest', '>=0', '1.x',
];
const grouped = new Map();
for (const rule of rules) {
  if (rule.detectors.length !== 1 || rule.detectors[0].kind !== 'dependency') continue;
  const detector = rule.detectors[0];
  if (detector.ecosystems.length !== 1 || detector.names.length !== 1) continue;
  const key = JSON.stringify([detector.ecosystems[0], detector.version ?? null]);
  grouped.set(key, [...(grouped.get(key) ?? []), rule]);
}
const errors = []; let assertions = 0; let covered = 0;
function manifest(ecosystem, declarations, excluded = false) {
  const entries = [...declarations];
  let name, content;
  switch (ecosystem) {
    case 'npm': name = 'package.json'; content = JSON.stringify({ dependencies: Object.fromEntries(entries) }); break;
    case 'python': name = 'requirements.txt'; content = entries.map(([pkg, v]) => pkg + '==' + v).join('\n'); break;
    case 'cargo': name = 'Cargo.toml'; content = '[dependencies]\n' + entries.map(([pkg, v]) => pkg + ' = "' + v + '"').join('\n'); break;
    case 'go': name = 'go.mod'; content = entries.map(([pkg, v]) => pkg + ' ' + v).join('\n'); break;
    case 'maven': name = 'pom.xml'; content = '<dependencies>' + entries.map(([pkg, v]) => {
      const [group, artifact] = pkg.split(':'); return '<dependency><groupId>' + (artifact ? group : 'org.example') + '</groupId><artifactId>' + (artifact ?? group) + '</artifactId><version>' + v + '</version></dependency>';
    }).join('') + '</dependencies>'; break;
    case 'gradle': name = 'build.gradle'; content = entries.map(([pkg, v]) => 'implementation "' + pkg + ':' + v + '"').join('\n'); break;
    case 'nuget': name = 'packages.config'; content = '<packages>' + entries.map(([pkg, v]) => '<package id="' + pkg + '" version="' + v + '" />').join('') + '</packages>'; break;
    case 'conan': name = 'conanfile.txt'; content = '[requires]\n' + entries.map(([pkg, v]) => pkg + '/' + v).join('\n'); break;
    case 'vcpkg': name = 'vcpkg.json'; content = JSON.stringify({ dependencies: entries.map(([pkg, v]) => ({ name: pkg, version: v })) }); break;
    case 'dart': name = 'pubspec.yaml'; content = 'name: sample\ndependencies:\n' + entries.map(([pkg, v]) => '  ' + pkg + ': "' + v + '"').join('\n'); break;
    case 'composer': name = 'composer.json'; content = JSON.stringify({ require: Object.fromEntries(entries) }); break;
    case 'swift': name = 'Package.swift'; content = entries.map(([pkg, v]) => '.package(url: "https://github.com/example/' + pkg + '.git", from: "' + v + '")').join(',\n'); break;
    default: throw Error('Unsupported fixture ecosystem: ' + ecosystem);
  }
  return file((excluded ? 'tests/' : '') + name, content);
}
for (const [key, group] of grouped) {
  const [ecosystem, pattern] = JSON.parse(key);
  const version = pattern === null ? '1.2.3' : samples.find(sample => new RegExp(pattern).test(sample));
  if (!version) { errors.push('No independent example for ' + ecosystem + ' ' + pattern); continue; }
  const pack = { schemaVersion: 3, id: 'org.ryzova.fixture.' + ecosystem + '.' + grouped.size,
    name: 'Dependency fixture', version: '3.0.0', publisher: 'RyzovaTech', description: 'Executable dependency scenarios.',
    uceCompatibility: '>=2.0.0 <4.0.0', technologies: [...new Set(group.flatMap(rule => rule.technologies))],
    modules: [...new Set(group.map(rule => rule.module))], rules: group };
  const declarations = new Map(group.map(rule => [rule.detectors[0].names[0], version]));
  const context = files => ({ files, technologies: pack.technologies });
  try {
    const positive = executeV3RulePacks([pack], context([manifest(ecosystem, declarations)]));
    const negative = executeV3RulePacks([pack], context([manifest(ecosystem,
      pattern === null ? new Map() : new Map([...declarations.keys()].map(name => [name, '1.2.3'])))]));
    const excluded = executeV3RulePacks([pack], context([manifest(ecosystem, declarations, true)]));
    const actual = new Set(positive.findings.map(finding => finding.ruleId));
    const unexpected = new Set(negative.findings.map(finding => finding.ruleId));
    const wrongScope = new Set(excluded.findings.map(finding => finding.ruleId));
    for (const rule of group) {
      assert.ok(actual.has(rule.id), 'positive ' + rule.id); assertions++;
      assert.ok(!unexpected.has(rule.id), 'negative ' + rule.id); assertions++;
      assert.ok(!wrongScope.has(rule.id), 'scope ' + rule.id); assertions++;
      covered++;
    }
  } catch (error) { errors.push(ecosystem + ' ' + pattern + ': ' + String(error)); }
}
function samplePath(glob) {
  const withoutStars = glob.replace(/\*\*\//g, 'src/').replace(/\*\*/g, 'src').replace(/tsconfig\*/g, 'tsconfig').replace(/\*/g, 'fixture').replace(/\?/g, 'x');
  return withoutStars.startsWith('/') ? withoutStars.slice(1) : withoutStars;
}
function configContent(detector) {
  if (detector.pattern) return syntaxWitness(detector.pattern);
  if (!detector.path) return detector.operator === 'equals' ? detector.value ?? '' : 'configuration present';
  const keys = detector.path.split('.');
  let value = detector.operator === 'equals' ? detector.value : detector.operator === 'matches'
    ? syntaxWitness(detector.value ?? '') : detector.operator === 'contains' ? detector.value : 'present';
  for (const key of keys.reverse()) value = { [key]: value };
  return JSON.stringify(value);
}
for (const rule of rules) {
  if (rule.detectors.length !== 1 || !['regex', 'config', 'manifest', 'ast'].includes(rule.detectors[0].kind)) continue;
  const detector = rule.detectors[0];
  try {
    const first = (detector.include ?? detector.files ?? ['src/fixture.ts'])[0];
    const candidate = samplePath(first);
    const content = detector.kind === 'regex' ? syntaxWitness(detector.pattern, detector.flags ?? '')
      : detector.kind === 'config' ? configContent(detector)
        : detector.kind === 'manifest' ? configContent(detector)
          : detector.query === 'call' ? detector.names[0] + '()'
            : detector.query === 'import' ? "import x from '" + detector.names[0] + "'"
              : detector.names[0] + ' = 1';
    const path = candidate.includes('**') ? candidate.replaceAll('**', 'src') : candidate;
    const pack = { schemaVersion: 3, id: 'org.ryzova.fixture.single', name: 'Rule fixture', version: '3.0.0', publisher: 'RyzovaTech',
      description: 'Executable rule scenarios.', uceCompatibility: '>=2.0.0 <4.0.0',
      technologies: rule.technologies, modules: [rule.module], rules: [rule] };
    const execute = files => executeV3RulePacks([pack], { files, technologies: rule.technologies }).findings.some(item => item.ruleId === rule.id);
    assert.ok(execute([file(path, content)]), 'positive ' + rule.id + ' path=' + path + ' witness=' + content.slice(0, 55)); assertions++;
    const benign = '/* unrelated safe code */';
    const negativeContent = detector.kind === 'config' && !detector.path && !detector.pattern ? '' : (detector.kind === 'regex' || detector.kind === 'config') && detector.pattern &&
      new RegExp(detector.pattern, detector.kind === 'regex' ? detector.flags ?? '' : '').test(benign) ? '' : benign;
    assert.ok(!execute([file(path, negativeContent)]), 'negative ' + rule.id); assertions++;
    assert.ok(!execute([file('tests/' + path, content)]), 'scope ' + rule.id); assertions++;
    covered++;
  } catch (error) { errors.push(String(error) + ' detector=' + JSON.stringify(rule.detectors[0])); }
}
const featureById = new Map(BROWSER_FEATURES.map(item => [item.id, item]));
function examplesForCorrelation(detector) {
  if (detector.mode === 'lockfile-version') {
    const name = detector.packageName;
    const manifest = version => file('package.json', JSON.stringify({ dependencies: { [name]: version } }));
    const lock = version => file('package-lock.json', JSON.stringify({ packages: { ['node_modules/' + name]: { version } } }));
    return [[manifest('1.2.3'), lock('1.1.0')], [manifest('1.2.3'), lock('1.2.3')],
      [file('tests/package.json', manifest('1.2.3').content), file('tests/package-lock.json', lock('1.1.0').content)]];
  }
  if (detector.mode === 'browser-target') {
    const feature = featureById.get(detector.featureId);
    if (!feature) throw Error('Unknown browser fixture feature ' + detector.featureId);
    const names = { Chrome: 'chrome', Firefox: 'firefox', Safari: 'safari', Edge: 'edge',
      'Chrome Android': 'and_chr', 'Safari iOS': 'ios_saf' };
    const code = syntaxWitness(feature.pattern.source, feature.pattern.flags);
    const extension = feature.kind === 'css' ? 'css' : feature.kind === 'html' ? 'html' : 'js';
    const source = file('src/feature.' + extension, code);
    const browser = names[detector.browser];
    return [[file('.browserslistrc', browser + ' 1'), source],
      [file('.browserslistrc', (browser === 'chrome' ? 'firefox' : 'chrome') + ' 9999'), source],
      [file('.browserslistrc', browser + ' 1'), file('tests/feature.' + extension, code)]];
  }
  if (detector.mode === 'flow') {
    const source = syntaxWitness(detector.sourcePattern);
    const variable = new RegExp(detector.sourcePattern).exec(source)?.[1];
    if (!variable) throw Error('No captured value path in ' + detector.sourcePattern);
    const sink = syntaxWitness(detector.sinkPattern.replaceAll('{{variable}}', variable));
    const name = samplePath(detector.include[0]);
    const positive = source + ';\n' + sink + ');\n';
    return [[file(name, positive)], [file(name, source + ';\nconst safe = 1;\n')],
      [file('tests/' + name, positive)]];
  }
  if (detector.mode === 'import-boundary') {
    const origin = samplePath(detector.include[0]);
    const target = samplePath(detector.target[0]);
    let relative = path.posix.relative(path.posix.dirname(origin), target);
    if (!relative.startsWith('.')) relative = './' + relative;
    return [[file(origin, "import secret from '" + relative + "';"), file(target, 'export default 42;')],
      [file(origin, "import safe from './safe';"), file(target, 'export default 42;')],
      [file('tests/' + origin, "import secret from '" + relative + "';"), file('tests/' + target, 'export default 42;')]];
  }
  const first = samplePath(detector.first.include[0]);
  const second = detector.relation === 'same-file' ? first : samplePath(detector.second.include[0]);
  const a = syntaxWitness(detector.first.pattern);
  const b = syntaxWitness(detector.second.pattern);
  const positive = first === second ? [file(first, a + '\n' + b)] : [file(first, a), file(second, b)];
  const excluded = positive.map(item => file('tests/' + item.path, item.content));
  return [positive, [file(first, a)], excluded];
}
for (const rule of rules) {
  if (rule.detectors.length !== 1 || rule.detectors[0].kind !== 'correlation') continue;
  try {
    const pack = { schemaVersion: 3, id: 'org.ryzova.fixture.correlation', name: 'Correlation fixture', version: '3.0.0',
      publisher: 'RyzovaTech', description: 'Executable correlation scenarios.',
      uceCompatibility: '>=2.0.0 <4.0.0', technologies: rule.technologies, modules: [rule.module], rules: [rule] };
    const execute = files => executeV3RulePacks([pack], { files, technologies: rule.technologies }).findings.some(item => item.ruleId === rule.id);
    const [positive, negative, excluded] = examplesForCorrelation(rule.detectors[0]);
    assert.ok(execute(positive), 'positive ' + rule.id + ' ' + positive.map(item => item.path + ':' + item.content.slice(0, 55))); assertions++;
    assert.ok(!execute(negative), 'negative ' + rule.id); assertions++;
    assert.ok(!execute(excluded), 'scope ' + rule.id); assertions++;
    covered++;
  } catch (error) { errors.push(String(error) + ' detector=' + JSON.stringify(rule.detectors[0])); }
}
for (const rule of rules) {
  if (rule.detectors[0].kind !== 'dependency' || rule.detectors.length === 1 &&
    rule.detectors[0].ecosystems.length === 1 && rule.detectors[0].names.length === 1) continue;
  try {
    const name = rule.detectors[0].names[0];
    const pack = { schemaVersion: 3, id: 'org.ryzova.fixture.multi', name: 'Multi-evidence fixture', version: '3.0.0',
      publisher: 'RyzovaTech', description: 'Executable multi-detector scenarios.',
      uceCompatibility: '>=2.0.0 <4.0.0', technologies: rule.technologies, modules: [rule.module], rules: [rule] };
    const execute = files => executeV3RulePacks([pack], { files, technologies: rule.technologies }).findings.some(item => item.ruleId === rule.id);
    const declaration = JSON.stringify({ dependencies: { [name]: '1.2.3' } });
    assert.ok(execute([file('package.json', declaration)]), 'positive ' + rule.id); assertions++;
    assert.ok(!execute([file('package.json', JSON.stringify({ dependencies: {} }))]), 'negative ' + rule.id); assertions++;
    assert.ok(!execute([file('tests/package.json', declaration)]), 'scope ' + rule.id); assertions++;
    covered++;
  } catch (error) { errors.push(String(error)); }
}
console.log(JSON.stringify({ totalRules: rules.length, dependencyRules: [...grouped.values()].reduce((n, group) => n + group.length, 0), covered, assertions, errors: errors.slice(0, 45), errorCount: errors.length }));
if (errors.length || covered !== rules.length || assertions !== rules.length * 3) process.exitCode = 1;
