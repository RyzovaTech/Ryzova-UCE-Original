import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

// Transpile only local trusted test modules in memory; never execute scanned code.
const root = path.resolve(import.meta.dirname, '..');
const cache = new Map();
const nativeRequire = createRequire(import.meta.url);
function load(file) {
  const resolved = path.resolve(root, file);
  if (cache.has(resolved)) return cache.get(resolved).exports;
  const module = { exports: {} };
  cache.set(resolved, module);
  if (resolved.endsWith('.json')) { module.exports = { default: JSON.parse(fs.readFileSync(resolved, 'utf8')) }; return module.exports; }
  const source = fs.readFileSync(resolved, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const requireLocal = (specifier) => {
    if (specifier === 'jszip') return { default: nativeRequire('jszip') };
    if (specifier.startsWith('@/')) return load(path.resolve(root, 'src', specifier.slice(2)) + '.ts');
    if (!specifier.startsWith('.')) return nativeRequire(specifier);
    const target = path.resolve(path.dirname(resolved), specifier);
    return load(path.extname(target) ? target : fs.existsSync(target + '.ts') ? target + '.ts' : path.join(target, 'index.ts'));
  };
  new Function('require', 'module', 'exports', outputText)(requireLocal, module, module.exports);
  return module.exports;
}
const { detectRegisteredTechnologies, validateTechnologyRegistry, TECHNOLOGY_REGISTRY } = load('src/lib/analyzer/technology-registry.ts');
const { TECHNOLOGY_KNOWLEDGE } = load('src/lib/analyzer/technology-knowledge.ts');
const { ECOSYSTEM_KNOWLEDGE } = load('src/lib/analyzer/ecosystem-knowledge.ts');
const { PLATFORM_KNOWLEDGE } = load('src/lib/analyzer/platform-knowledge.ts');
const { buildTechnologyGraph, PROJECT_CAPABILITY_COUNT } = load('src/lib/analyzer/technology-graph.ts');
const { collectEcosystemDependencies } = load('src/lib/analyzer/ecosystem-dependencies.ts');
const { ADDITIONAL_LANGUAGE_EXTENSIONS } = load('src/lib/analyzer/language-knowledge.ts');
const { detectLanguageProfile } = load('src/lib/analyzer/language-profile.ts');
const { classifyProjectFileScope } = load('src/lib/analyzer/project-scope.ts');
const { analyzeProject } = load('src/lib/analyzer/analyzer.ts');
const { buildRecommendations } = load('src/lib/compatibility/recommendations/index.ts');
const { detectBrowserCompatibility, resolveBrowserTargets } = load('src/lib/analyzer/browser-compatibility.ts');
const { BROWSER_FEATURES } = load('src/lib/analyzer/browser-knowledge.ts');
const { detectSecurityIntelligence, isNonProductionPath } = load('src/lib/analyzer/security-intelligence.ts');
const { SECURITY_RULES, validateSecurityRules } = load('src/lib/analyzer/security-knowledge.ts');
const { detectCodeIntelligence } = load('src/lib/analyzer/code-intelligence.ts');
const { detectDependencyIntelligence, detectTechnologyIntelligence } = load('src/lib/analyzer/intelligence.ts');
const { buildCorrelatedInsights } = load('src/lib/analyzer/correlated-intelligence.ts');
const { detectExtendedIntelligence } = load('src/lib/analyzer/extended-intelligence.ts');
const { CORE_KNOWLEDGE_PACK } = load('src/lib/knowledge/core-pack.ts');
const { validateKnowledgePack, exportKnowledgePack, importKnowledgePack } = load('src/lib/knowledge/validator.ts');
const { buildTrustMetadata } = load('src/lib/analyzer/trust.ts');
const { prepareAnalysisInput, fingerprintAnalysisInput, diffAnalysisInputs } = load('src/lib/analyzer/execution.ts');
const { validateDetectorRule, runDetectorRules } = load('src/lib/knowledge/sdk.ts');
const { canonicalKnowledgePack, verifyKnowledgePack } = load('src/lib/knowledge/signatures.ts');
const { PHASE5_ACCURACY_FIXTURES } = load('testing/fixtures/phase5/corpus.ts');
const REAL_REPOSITORY_MANIFESTS = JSON.parse(fs.readFileSync(path.join(root, 'testing/fixtures/v3-real-repositories.json'), 'utf8'));
const { collectWorkspaceFindings, groupWorkspaceFindings, compareReports, compatibleProjectReports } = load('src/lib/report/workspace.ts');
const { classifyProject } = load('src/lib/analyzer/classifier.ts');
const { detectLanguage, detectStack } = load('src/lib/analyzer/detectors.ts');
const { detectTechnologyProfiles } = load('src/lib/analyzer/technology-profiles.ts');
const { parseFiles } = load('src/lib/analyzer/parser.ts');
const { UCE_CATALOG_ITEMS } = load('src/lib/catalog.ts');
const { getGitHubArchiveUrl, parseGitHubRepositoryUrl } = load('src/lib/analyzer/repository.ts');
const { archiveProcessingTimeoutMs, GITHUB_ARCHIVE_TIMEOUT_MS, MAX_COMPRESSED_ARCHIVE_BYTES } = load('src/lib/analyzer/archive-policy.ts');
const { V3_CORE_RULE_PACK } = load('src/lib/knowledge/v3-core-pack.ts');
const { V3_DEFAULT_RULE_PACKS } = load('src/lib/knowledge/v3-default-packs.ts');
const { V3_PHASE2_RULE_COUNT, V3_PHASE2_RULE_PACKS, V3_PHASE2_RULE_TARGET, V3_TOTAL_CORE_RULE_TARGET } = load('src/lib/knowledge/v3-phase2-packs.ts');
const { V3_PHASE3_RULE_PACKS, V3_PHASE3_RULE_COUNT, V3_PHASE3_TARGET, V3_PHASE3_TOTAL_TARGET } = load('src/lib/knowledge/v3-phase3-packs.ts');
const { V3_PHASE4_RULE_PACKS, V3_PHASE4_RULE_COUNT, V3_PHASE4_RULE_TARGET, V3_PHASE4_TOTAL_TARGET } = load('src/lib/knowledge/v3-phase4-packs.ts');
const { V3_PHASE5_RULE_PACKS, V3_PHASE5_RULE_COUNT, V3_PHASE5_RULE_TARGET, V3_PHASE5_TOTAL_TARGET, V3_PHASE5_POLICIES } = load('src/lib/knowledge/v3-phase5-packs.ts');
const { validateV3RulePack, analyzeV3RuleGraph, detectorSignature } = load('src/lib/knowledge/v3-validator.ts');
const { executeV3RulePacks } = load('src/lib/knowledge/v3-sdk.ts');
const { V3RuleRegistry } = load('src/lib/knowledge/v3-registry.ts');
const { readZip } = load('src/lib/analyzer/zip.ts');
const { canonicalV3RulePack, signV3RulePack, verifyV3RulePack } = load('src/lib/knowledge/v3-signatures.ts');
const { generateV3RuleDocumentation } = load('src/lib/knowledge/v3-docs.ts');
const file = (name, content = '') => ({ path: name, content, size: Buffer.byteLength(content), isDirectory: false });
const pkg = (name, deps) => file(name, JSON.stringify({ dependencies: deps }));
let checks = 0;
let phase5FixtureAssertions = 0;
function test(name, run) { run(); checks++; console.log('PASS ' + name); }
async function asyncTest(name, run) { await run(); checks++; console.log('PASS ' + name); }

test('Python package metadata, documentation and testing agree across report modules', () => {
  const files = [
    file('pyproject.toml', `[project]\nname = "signed-library"\nrequires-python = ">=3.10"\nlicense = "BSD-3-Clause"\n[dependency-groups]\ntests = ["pytest", "freezegun"]\n[build-system]\nrequires = ["flit_core<4"]\nbuild-backend = "flit_core.buildapi"\n[tool.pytest.ini_options]\ntestpaths = ["tests"]\n[tool.coverage.run]\nbranch = true\n`),
    file('uv.lock', 'version = 1'), file('README.md', '# Library\n## Usage'),
    file('LICENSE.txt', 'Redistribution and use in source and binary forms\nRedistributions of source code\nRedistributions in binary form\nNeither the name of the copyright holder'),
    file('CHANGES.rst', 'Release history'), file('CONTRIBUTING.rst', 'Contribution guide'),
    file('src/demo/__init__.py', 'from .signer import Signer'),
    file('src/demo/signer.py', '"""A class constructor. The function must verify."""\nclass Signer:\n    def verify(self):\n        return True\n'),
    file('tests/test_signer.py', 'def test_signer(): pass'),
  ];
  const report = analyzeProject({ files, fileName: 'python-library', source: 'upload', scanStats: { projectSize: 1000, filesFound: files.length, filesAnalyzed: files.length, filesIgnored: 0, ignoredCategories: [] } });
  for (const id of ['python-version-missing', 'license-unrecognized', 'changelog-missing', 'contributing-missing']) assert.ok(!report.issues.some(issue => issue.id === id), id);
  assert.equal(report.stack.buildTool, 'Flit');
  assert.equal(report.stack.extendedIntelligence.modules.runtime.metrics.versionDeclarations, 1);
  assert.equal(report.stack.architecture.primary, 'Library');
  assert.equal(report.stack.extendedIntelligence.modules.testing.metrics.coverageReady, true);
  assert.ok(report.stack.dependencyIntelligence.dependencies.some(item => item.name === 'pytest' && item.type === 'development'));
  assert.ok(report.stack.codeIntelligence.dependencyEdges.some(edge => edge.to === 'src/demo/signer.py'));
  assert.deepEqual(report.stack.codeIntelligence.symbols.map(item => item.name).sort(), ['Signer', 'verify']);
  assert.equal(report.stack.codeIntelligence.symbols.find(item => item.name === 'verify').line, 3);
  assert.deepEqual(report.stack.codeIntelligence.quality.unreferencedModules, []);
  assert.ok(report.notes.some(note => note.includes('no browser source files checked')));
});
test('Python metadata absence, comments and production risks remain visible', () => {
  const files = [file('pyproject.toml', '[project]\nname = "demo"'), file('src/demo.py', 'import hashlib\ndef digest(value):\n    return hashlib.sha1(value)')];
  const report = analyzeProject({ files, fileName: 'demo', source: 'upload', scanStats: { projectSize: 100, filesFound: files.length, filesAnalyzed: files.length, filesIgnored: 0, ignoredCategories: [] } });
  assert.ok(report.issues.some(item => item.id === 'python-version-missing'));
  const finding = report.stack.securityIntelligence.findings.find(item => item.ruleId === 'SEC020');
  assert.equal(finding.certainty, 'review-required');
  assert.equal(finding.line, 3);
  const docs = detectSecurityIntelligence([file('src/docs.py', '# hashlib.sha1(data)\n"""hashlib.sha1(data)"""')]);
  assert.ok(!docs.findings.some(item => item.ruleId === 'SEC020'));
  assert.equal(classifyProjectFileScope('test_signer.py'), 'test');
});
test('Python absolute and relative imports resolve without inventing symbols from docstrings', () => {
  const result = detectCodeIntelligence([
    file('src/demo/__init__.py', 'from . import signer'),
    file('src/demo/signer.py', 'import demo.helper\nfrom .helper import verify\ntext = "class Fake"\nasync def sign():\n    return verify()'),
    file('src/demo/helper.py', 'def verify():\n    return True'),
  ]);
  assert.ok(result.dependencyEdges.some(edge => edge.from === 'src/demo/__init__.py' && edge.to === 'src/demo/signer.py'));
  assert.ok(result.dependencyEdges.some(edge => edge.from === 'src/demo/signer.py' && edge.to === 'src/demo/helper.py'));
  assert.deepEqual(result.symbols.map(item => item.name).sort(), ['sign', 'verify']);
});

test('Python metadata reader handles extras, optional groups and ignores include-group references', () => {
  const { pythonDependencies, pythonVersionRequirement } = load('src/lib/analyzer/python-evidence.ts');
  const deps = pythonDependencies('[project]\ndependencies = ["requests[socks]>=2", "httpx"]\n[dependency-groups]\ntests = ["pytest", {include-group = "typing"}]\n[project.optional-dependencies]\nweb = ["flask>=3"]');
  assert.deepEqual(deps.map(item => item.name), ['requests', 'httpx', 'pytest', 'flask']);
  assert.equal(deps[0].version, '>=2');
  assert.equal(deps[3].type, 'optional');
  assert.equal(pythonVersionRequirement('[project]\n# requires-python = ">=3.10"'), undefined);
  assert.equal(pythonVersionRequirement('[tool.unrelated]\nrequires-python = ">=3.10"'), undefined);
  assert.equal(pythonVersionRequirement('[tool.poetry.dependencies]\npython = "^3.11"'), '^3.11');
});
test('registry definitions are valid and uniquely named', () => assert.deepEqual(validateTechnologyRegistry(), []));
test('empty repository produces no detections', () => assert.deepEqual(detectRegisteredTechnologies([]), []));
test('slugify-style library report recognizes lowercase docs, AVA test.js and unique technology evidence', () => {
  const files = [
    file('package.json', JSON.stringify({ name: '@sindresorhus/slugify', type: 'module', license: 'MIT', exports: './index.js', engines: { node: '>=20' }, scripts: { test: 'xo && ava' }, dependencies: { 'escape-string-regexp': '^5.0.0' }, devDependencies: { ava: '^6.4.1', xo: '^1.2.2' } })),
    file('index.js', 'export default function slugify(value) { return value.toLowerCase(); }'),
    file('index.d.ts', 'export default function slugify(value: string): string;'),
    file('test.js', "import test from 'ava'; test('slugify', t => t.is(1, 1));"),
    file('readme.md', '# slugify\n## Install\n## Usage\n'),
    file('license', 'MIT License\nPermission is hereby granted, free of charge'),
    file('.github/workflows/main.yml', 'name: CI\non: push\n'),
  ];
  const result = analyzeProject({ files, fileName: 'slugify', source: 'github', scanStats: { projectSize: 14_102, filesFound: files.length, filesAnalyzed: files.length, filesIgnored: 0, ignoredCategories: [] } });
  const ids = result.issues.map(issue => issue.id);
  for (const id of ['readme-missing', 'license-missing', 'tests-dir-missing', 'node-version-file-missing', 'env-example-missing', 'eslint-config-missing', 'prettier-config-missing', 'lockfile-missing-npm', 'deps-no-lockfile']) assert.ok(!ids.includes(id), `${id} is a false signal`);
  assert.equal(result.stack.extendedIntelligence.modules.testing.metrics.testFiles, 1);
  assert.equal(result.stack.extendedIntelligence.modules.license.metrics.licenseFile, true);
  assert.equal(result.analysisVersion, 'uce-3.0.0-beta.1');
  const detections = result.stack.technologyDetections.map(item => `${item.kind}:${item.name.toLowerCase()}`);
  assert.equal(new Set(detections).size, detections.length);
  const catalog = result.stack.v3RulePlatform.findings.filter(item => item.ruleId.startsWith('technology.catalog.')).map(item => `${item.title}:${item.file}`);
  assert.equal(new Set(catalog).size, catalog.length);
});
test('unknown categories do not become urgent recommendations', () => {
  const categories = [{ id: 'environment', label: 'Environment', status: 'unknown', score: 0, issues: [] }, { id: 'runtime', label: 'Runtime', status: 'good', score: 100, issues: [] }];
  assert.ok(!buildRecommendations(categories).some(item => item.includes('Environment')));
});
test('V3 scans invalidate cached V2 results', () => {
  const key = fingerprintAnalysisInput({ files: [file('package.json', '{}')], fileName: 'slugify', source: 'github', scanStats: { projectSize: 2, filesFound: 1, filesAnalyzed: 1, filesIgnored: 0, ignoredCategories: [] } });
  assert.match(key, /^uce3-/);
});
test('missing project evidence still generates relevant advisories', () => {
  const files = [
    file('package.json', JSON.stringify({ private: true, scripts: { start: 'node src/app.js' }, dependencies: { express: '^4.0.0' } })),
    file('src/app.js', 'const port = process.env.APP_PORT; export { port };'),
  ];
  const report = analyzeProject({ files, fileName: 'web-app', source: 'upload', scanStats: { projectSize: 150, filesFound: files.length, filesAnalyzed: files.length, filesIgnored: 0, ignoredCategories: [] } });
  const ids = report.issues.map(item => item.id);
  for (const id of ['readme-missing', 'license-missing', 'tests-dir-missing', 'env-example-missing', 'lockfile-missing-npm']) assert.ok(ids.includes(id), `${id} should remain detectable`);
  assert.ok(!ids.includes('deps-no-lockfile'), 'a missing lockfile should not be reported as a second security vulnerability');
});
test('107 distinct real repository manifest snapshots detect their declared frameworks', () => {
  const expectations = new Map([
    ['next', 'nextjs'], ['react', 'react'], ['vue', 'vue'], ['electron', 'electron'],
    ['express', 'express'], ['@angular/core', 'angular'], ['svelte', 'svelte'],
    ['vite', 'vite'], ['vitest', 'vitest'], ['jest', 'jest'], ['@playwright/test', 'playwright'],
    ['tailwindcss', 'tailwind'],
  ]);
  const inventory = new Map(V3_PHASE2_RULE_PACKS.flatMap(pack => pack.rules).map(rule => [rule.id, rule]));
  assert.ok(REAL_REPOSITORY_MANIFESTS.fixtures.length >= 100);
  assert.equal(new Set(REAL_REPOSITORY_MANIFESTS.fixtures.map(item => item.repository)).size, REAL_REPOSITORY_MANIFESTS.fixtures.length);
  for (const fixture of REAL_REPOSITORY_MANIFESTS.fixtures) {
    assert.match(fixture.sha, /^[a-f0-9]{40}$/);
    const expected = [...expectations].find(([name, id]) => Object.hasOwn(fixture.dependencies, name) && inventory.has(`technology.catalog.${id}`));
    assert.ok(expected, `${fixture.repository}: no independently mapped technology`);
    const [dependency, id] = expected;
    const rule = inventory.get(`technology.catalog.${id}`);
    const selected = { ...V3_PHASE2_RULE_PACKS[0], modules: [rule.module], technologies: rule.technologies, rules: [rule] };
    const scan = (dependencies) => executeV3RulePacks([selected], {
      files: [pkg('package.json', dependencies)], technologies: rule.technologies,
    }).findings.some(finding => finding.ruleId === rule.id);
    assert.ok(scan({ [dependency]: fixture.dependencies[dependency] }), `${fixture.repository}: expected ${id}`);
    assert.equal(scan({ 'unrelated-fixture-package': '1.0.0' }), false, `${fixture.repository}: unrelated dependency matched ${id}`);
  }
});
test('GitHub repository imports use the same-origin archive relay', () => {
  const repository = parseGitHubRepositoryUrl('https://github.com/RyzovaTech/Ryzova-UCE-Original');
  assert.equal(repository.owner, 'RyzovaTech');
  assert.equal(repository.repository, 'Ryzova-UCE-Original');
  assert.equal(getGitHubArchiveUrl(repository, 'release/next'), '/api/github/archive/RyzovaTech/Ryzova-UCE-Original/release/next');
  assert.ok(!getGitHubArchiveUrl(repository, 'main').includes('codeload.github.com'));
});
test('large archives use adaptive processing instead of the legacy 50MB cutoff', () => {
  const fiftyMiB = 50 * 1024 * 1024;
  assert.ok(MAX_COMPRESSED_ARCHIVE_BYTES > fiftyMiB);
  assert.ok(archiveProcessingTimeoutMs(500 * 1024 * 1024) > archiveProcessingTimeoutMs(fiftyMiB));
  assert.ok(GITHUB_ARCHIVE_TIMEOUT_MS >= 10 * 60_000);
  const hookSource = fs.readFileSync(path.join(root, 'src/hooks/useAnalyzer.ts'), 'utf8');
  const pageSource = fs.readFileSync(path.join(root, 'src/pages/AnalyzePage.tsx'), 'utf8');
  assert.ok(!hookSource.includes('MAX_ARCHIVE_SIZE'));
  assert.ok(!pageSource.includes('ZIP archives up to 50 MB'));
});
test('V3 core rule pack satisfies the executable schema', () => {
  const validation = validateV3RulePack(V3_CORE_RULE_PACK);
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(validation.signed, false);
  assert.ok(validation.warnings.some((item) => item.includes('unsigned')));
});
test('V3 DSL executes regex, AST, manifest, dependency and config detectors', () => {
  const files = [
    file('src/app.ts', 'eval(input); element.innerHTML = html;'),
    file('tsconfig.json', JSON.stringify({ compilerOptions: { strict: false } })),
    file('package.json', JSON.stringify({ dependencies: { react: 'latest' } })),
    file('Dockerfile', 'FROM node:latest'),
  ];
  const result = executeV3RulePacks([V3_CORE_RULE_PACK], { files, technologies: ['typescript', 'javascript', 'react', 'docker'] });
  assert.equal(result.schemaVersion, 3); assert.equal(result.rulesExecuted, 5);
  for (const kind of ['regex', 'ast', 'manifest', 'dependency', 'config']) assert.ok(result.findings.some((finding) => finding.evidence.some((item) => item.detector === kind)), `missing ${kind}`);
  assert.ok(result.metrics.every((metric) => metric.durationMs >= 0 && metric.filesVisited <= 25_000));
});
test('V3 config patterns do not match unrelated non-empty files', () => {
  const rule = V3_PHASE2_RULE_PACKS.flatMap(pack => pack.rules).find(item => item.id === 'technology.catalog.django');
  const pack = { ...V3_PHASE2_RULE_PACKS[0], modules: [rule.module], technologies: rule.technologies, rules: [rule] };
  const result = executeV3RulePacks([pack], { files: [file('requirements.txt', 'flask==1.2.3\n')], technologies: rule.technologies });
  assert.deepEqual(result.findings, []);
});
test('V3 rules respect technology, module and production scope filters', () => {
  const files = [file('tests/app.ts', 'eval(input)'), file('src/app.ts', 'eval(input)')];
  const applicable = executeV3RulePacks([V3_CORE_RULE_PACK], { files, technologies: ['typescript'], modules: ['security'] });
  assert.equal(applicable.rulesExecuted, 1); assert.deepEqual(applicable.findings.map((item) => item.file), ['src/app.ts']);
  const irrelevant = executeV3RulePacks([V3_CORE_RULE_PACK], { files, technologies: ['python'], modules: ['security'] });
  assert.equal(irrelevant.rulesExecuted, 0); assert.equal(irrelevant.findings.length, 0);
});
test('V3 graph detects missing dependencies, cycles, conflicts and duplicate ids', () => {
  const makeRule = (id) => ({ ...structuredClone(V3_CORE_RULE_PACK.rules[0]), id });
  const missing = makeRule('org.test.missing'); missing.dependsOn = ['org.test.unknown'];
  assert.equal(analyzeV3RuleGraph([{ ...V3_CORE_RULE_PACK, rules: [missing] }]).missingDependencies.length, 1);
  const left = makeRule('org.test.left'); const right = makeRule('org.test.right'); left.dependsOn = [right.id]; right.dependsOn = [left.id]; left.conflictsWith = [right.id];
  const graph = analyzeV3RuleGraph([{ ...V3_CORE_RULE_PACK, rules: [left, right, { ...left }] }]);
  assert.ok(graph.cycles.length); assert.ok(graph.conflicts.length); assert.ok(graph.duplicates.includes(left.id));
});
test('V3 registry lazy-loads only applicable packs and allows explicit organization imports', async () => {
  const registry = new V3RuleRegistry(); let loads = 0;
  registry.registerLazyPack({ id: V3_CORE_RULE_PACK.id, version: V3_CORE_RULE_PACK.version, technologies: ['typescript'], modules: V3_CORE_RULE_PACK.modules, load: async () => { loads++; return V3_CORE_RULE_PACK; } });
  await registry.loadApplicablePacks({ files: [], technologies: ['python'] }); assert.equal(loads, 0);
  const packs = await registry.loadApplicablePacks({ files: [], technologies: ['typescript'] }); assert.equal(loads, 1); assert.equal(packs.length, 1);
  const organization = new V3RuleRegistry(); assert.throws(() => organization.importOrganizationPack(JSON.stringify(V3_CORE_RULE_PACK)));
  organization.importOrganizationPack(JSON.stringify(V3_CORE_RULE_PACK), true); assert.equal(organization.list()[0].source, 'organization');
});
test('V3 rule budgets truncate safely and documentation is generated deterministically', () => {
  const rule = structuredClone(V3_CORE_RULE_PACK.rules[0]); rule.budget = { maxFiles: 1, maxMatches: 1, maxContentBytes: 10, maxMilliseconds: 100 };
  const result = executeV3RulePacks([{ ...V3_CORE_RULE_PACK, rules: [rule] }], { files: [file('src/a.ts', 'eval(a); eval(b);'), file('src/b.ts', 'eval(c);')], technologies: ['typescript'] });
  assert.equal(result.metrics[0].truncated, true); assert.ok(result.findings.length <= 1);
  const docs = generateV3RuleDocumentation(V3_CORE_RULE_PACK); assert.ok(docs.includes('UCE V3 Core Rules') && docs.includes('security.javascript.dynamic-eval'));
  assert.equal(canonicalV3RulePack(V3_CORE_RULE_PACK), canonicalV3RulePack({ ...V3_CORE_RULE_PACK, signature: { algorithm: 'ed25519', keyId: 'x', digest: `sha256:${'0'.repeat(64)}`, signature: 'x' } }));
});
test('V3 built-in packs have a registration boundary outside analyzer core', () => {
  const analyzerSource = fs.readFileSync(path.join(root, 'src/lib/analyzer/analyzer.ts'), 'utf8');
  const registrySource = fs.readFileSync(path.join(root, 'src/lib/knowledge/v3-default-packs.ts'), 'utf8');
  assert.ok(analyzerSource.includes('V3_DEFAULT_RULE_PACKS')); assert.ok(!analyzerSource.includes('V3_CORE_RULE_PACK'));
  assert.ok(registrySource.includes('V3_CORE_RULE_PACK'));
});
test('V3 Phase 2 publishes exactly 3,000 validated core rules', () => {
  assert.equal(V3_PHASE2_RULE_COUNT, V3_PHASE2_RULE_TARGET);
  assert.equal([V3_CORE_RULE_PACK, ...V3_PHASE2_RULE_PACKS].reduce((total, pack) => total + pack.rules.length, 0), V3_TOTAL_CORE_RULE_TARGET);
  for (const pack of [V3_CORE_RULE_PACK, ...V3_PHASE2_RULE_PACKS]) {
    const validation = validateV3RulePack(pack);
    assert.equal(validation.valid, true, `${pack.id}:\n${validation.errors.join('\n')}`);
  }
  const graph = analyzeV3RuleGraph([V3_CORE_RULE_PACK, ...V3_PHASE2_RULE_PACKS]);
  assert.deepEqual(graph.duplicates, []); assert.deepEqual(graph.missingDependencies, []);
  assert.deepEqual(graph.cycles, []); assert.deepEqual(graph.conflicts, []);
  assert.equal(new Set([V3_CORE_RULE_PACK, ...V3_PHASE2_RULE_PACKS].flatMap(pack => pack.rules.map(rule => rule.id))).size, V3_TOTAL_CORE_RULE_TARGET);
});
test('V3 Phase 3 adds exactly 3,500 unique validated rules in 13 deep ecosystem packs', () => {
  assert.equal(V3_PHASE3_RULE_COUNT, V3_PHASE3_TARGET);
  assert.equal([V3_CORE_RULE_PACK, ...V3_PHASE2_RULE_PACKS, ...V3_PHASE3_RULE_PACKS].reduce((n, pack) => n + pack.rules.length, 0), V3_PHASE3_TOTAL_TARGET);
  assert.equal(V3_PHASE3_RULE_PACKS.length, 13);
  for (const pack of V3_PHASE3_RULE_PACKS) {
    assert.ok(pack.rules.length, `empty pack ${pack.id}`);
    const validation = validateV3RulePack(pack);
    assert.equal(validation.valid, true, `${pack.id}: ${validation.errors.join('; ')}`);
  }
  const graph = analyzeV3RuleGraph([V3_CORE_RULE_PACK, ...V3_PHASE2_RULE_PACKS, ...V3_PHASE3_RULE_PACKS]);
  assert.deepEqual(graph.duplicates, []); assert.deepEqual(graph.missingDependencies, []);
  assert.deepEqual(graph.conflicts, []); assert.deepEqual(graph.cycles, []);
});
test('V3 Phase 4 publishes 9,000 unique executable rules across evidence-linked packs', () => {
  assert.equal(V3_PHASE4_RULE_COUNT, V3_PHASE4_RULE_TARGET);
  assert.equal([V3_CORE_RULE_PACK, ...V3_PHASE2_RULE_PACKS, ...V3_PHASE3_RULE_PACKS, ...V3_PHASE4_RULE_PACKS].reduce((total, pack) => total + pack.rules.length, 0), V3_PHASE4_TOTAL_TARGET);
  assert.equal(V3_PHASE4_RULE_PACKS.length, 5);
  for (const pack of V3_PHASE4_RULE_PACKS) {
    const validation = validateV3RulePack(pack);
    assert.equal(validation.valid, true, pack.id + ': ' + validation.errors.slice(0, 3).join('; '));
  }
  const graph = analyzeV3RuleGraph([V3_CORE_RULE_PACK, ...V3_PHASE2_RULE_PACKS, ...V3_PHASE3_RULE_PACKS, ...V3_PHASE4_RULE_PACKS]);
  assert.deepEqual(graph.duplicates, []); assert.deepEqual(graph.missingDependencies, []);
  assert.deepEqual(graph.cycles, []); assert.deepEqual(graph.conflicts, []);
  assert.ok(V3_PHASE4_RULE_PACKS.flatMap(pack => pack.rules).every(item => item.severity !== 'critical' && item.detectors.every(detector => detector.kind === 'correlation')));
});
test('V3 Phase 5 adds 1,000 unique review rules without colliding with previous signatures', () => {
  assert.equal(V3_PHASE5_RULE_COUNT, V3_PHASE5_RULE_TARGET);
  assert.equal(V3_DEFAULT_RULE_PACKS.reduce((n, pack) => n + pack.rules.length, 0), V3_PHASE5_TOTAL_TARGET);
  for (const pack of V3_PHASE5_RULE_PACKS) {
    const result = validateV3RulePack(pack);
    assert.equal(result.valid, true, pack.id + ': ' + result.errors.slice(0, 3).join('; '));
  }
  const graph = analyzeV3RuleGraph(V3_DEFAULT_RULE_PACKS);
  assert.deepEqual(graph.duplicates, []);
  assert.deepEqual(graph.missingDependencies, []);
  assert.deepEqual(graph.cycles, []);
  assert.deepEqual(graph.conflicts, []);
  const signatures = new Map();
  for (const rule of V3_DEFAULT_RULE_PACKS.flatMap(pack => pack.rules)) {
    const signature = detectorSignature(rule);
    assert.equal(signatures.has(signature), false, rule.id + ' duplicates ' + signatures.get(signature));
    signatures.set(signature, rule.id);
  }
  assert.equal(signatures.size, V3_PHASE5_TOTAL_TARGET);
  const invalid = structuredClone(V3_PHASE5_RULE_PACKS[0].rules[0]);
  invalid.detectors[0].version = '*broken';
  assert.equal(validateV3RulePack({ ...V3_PHASE5_RULE_PACKS[0], rules: [invalid] }).valid, false);
});
test('every new Phase 5 rule has a positive, negative and excluded-scope executable fixture', () => {
  const all = V3_PHASE5_RULE_PACKS.flatMap(pack => pack.rules);
  for (const policy of V3_PHASE5_POLICIES) {
    const selected = all.filter(rule => rule.tags.includes(policy.id));
    const pack = { ...V3_PHASE5_RULE_PACKS[0], id: 'com.ryzova.uce.fixture.' + policy.id, rules: selected,
      technologies: [...new Set(selected.flatMap(rule => rule.technologies))] };
    const values = Object.fromEntries(selected.map(rule => [rule.detectors[0].names[0], policy.example]));
    const technologies = pack.technologies;
    const positive = executeV3RulePacks([pack], { files: [pkg('package.json', values)], technologies });
    const negative = executeV3RulePacks([pack], { files: [pkg('package.json', Object.fromEntries(Object.keys(values).map(name => [name, '1.2.3'])))], technologies });
    const excluded = executeV3RulePacks([pack], { files: [pkg('tests/package.json', values)], technologies });
    const found = new Set(positive.findings.map(item => item.ruleId));
    const unexpected = new Set(negative.findings.map(item => item.ruleId));
    const wronglyScoped = new Set(excluded.findings.map(item => item.ruleId));
    for (const rule of selected) {
      assert.ok(found.has(rule.id), 'positive: ' + rule.id); phase5FixtureAssertions++;
      assert.ok(!unexpected.has(rule.id), 'negative: ' + rule.id); phase5FixtureAssertions++;
      assert.ok(!wronglyScoped.has(rule.id), 'scope: ' + rule.id); phase5FixtureAssertions++;
    }
  }
  assert.equal(phase5FixtureAssertions, V3_PHASE5_RULE_TARGET * 3);
});
test('CI SARIF exports rule-level evidence and physical source locations', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'uce-v3-sarif-'));
  try {
    const report = JSON.parse(fs.readFileSync(path.join(root, 'testing/fixtures/phase5/ci-pass-report.json'), 'utf8'));
    report.stack.v3RulePlatform = { findings: [{
      ruleId: V3_PHASE5_RULE_PACKS[0].rules[0].id, packId: V3_PHASE5_RULE_PACKS[0].id,
      title: 'Version review', module: 'dependency', severity: 'warning', confidence: 'review-required',
      file: 'src/package.json', line: 4, evidence: [{ detector: 'dependency', file: 'src/package.json', line: 4, detail: 'version TODO' }],
      recommendation: 'Pin the version.', falsePositiveNotes: [],
    }] };
    const input = path.join(directory, 'report.json'); const output = path.join(directory, 'results.sarif');
    fs.writeFileSync(input, JSON.stringify(report));
    const run = spawnSync(process.execPath, [path.join(root, 'scripts/uce-ci.mjs'), input, '--sarif=' + output], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const results = JSON.parse(fs.readFileSync(output, 'utf8')).runs[0].results;
    assert.ok(results.some(item => item.ruleId === report.stack.v3RulePlatform.findings[0].ruleId &&
      item.locations[0].physicalLocation.artifactLocation.uri === 'src/package.json' &&
      item.locations[0].physicalLocation.region.startLine === 4));
    const annotations = spawnSync(process.execPath, [path.join(root, 'scripts/uce-ci.mjs'), input, '--annotations'],
      { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: 'true' } });
    assert.equal(annotations.status, 0, annotations.stderr);
    assert.ok(annotations.stdout.includes('::warning file=src/package.json,line=4,title=' +
      report.stack.v3RulePlatform.findings[0].ruleId + '::'));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('V3 correlations require related browser target, lockfile, flow and real import evidence', () => {
  const selected = V3_PHASE4_RULE_PACKS.map(pack => ({ ...pack, rules: pack.rules.filter(item =>
    /browser-target.*css-has.*firefox|manifest-lockfile.*react-|value-flow.*javascript-0-0-|import-boundary.*src-components-src-server-/.test(item.id)) })).filter(pack => pack.rules.length);
  const files = [
    file('.browserslistrc', 'Firefox 100'), file('src/site.css', 'article:has(img) { color: red }'),
    pkg('package.json', { react: '18.3.1' }), file('package-lock.json', '{"packages":{"node_modules/react":{"version":"17.0.2"}}}'),
    file('src/components/client.ts', "import secrets from '../server/secrets';\nconst value = req.query.id;\neval(value);"),
    file('src/server/secrets.ts', 'export default "test";'),
  ];
  const actual = executeV3RulePacks(selected, { files, technologies: ['javascript', 'typescript', 'react'] });
  for (const group of ['browser-target', 'manifest-lockfile', 'value-flow', 'import-boundary'])
    assert.ok(actual.findings.some(item => item.ruleId.includes(group)), 'missing ' + group);
  assert.ok(actual.findings.some(item => item.evidence.some(evidence => evidence.relatedFile === 'package-lock.json')));
  assert.ok(actual.findings.every(item => item.confidence === 'review-required' && item.severity !== 'critical'));
  const negative = executeV3RulePacks(selected, { files: [
    file('tests/site.css', 'article:has(img) {}'), pkg('package.json', { react: '18.3.1' }),
    file('package-lock.json', '{"packages":{"node_modules/react":{"version":"18.3.1"}}}'),
    file('src/components/client.ts', 'const value = "safe"; eval(value);'),
    file('src/server/secrets.ts', 'export default "test";'),
  ], technologies: ['javascript', 'typescript', 'react'] });
  assert.equal(negative.findings.length, 0);
});
test('V3 refuses raw regex critical security claims', () => {
  const unsafe = structuredClone(V3_CORE_RULE_PACK.rules[0]);
  unsafe.severity = 'critical';
  assert.equal(validateV3RulePack({ ...V3_CORE_RULE_PACK, rules: [unsafe] }).valid, false);
  const flow = structuredClone(V3_PHASE4_RULE_PACKS.find(pack => pack.id.endsWith('.value-flow')).rules[0]);
  flow.severity = 'critical'; flow.confidence = 'confirmed';
  assert.equal(validateV3RulePack({ ...V3_PHASE4_RULE_PACKS.find(pack => pack.id.endsWith('.value-flow')), rules: [flow] }).valid, false);
});
test('V3 flow avoids reassigned variables and separate test-scope code', () => {
  const flowPack = V3_PHASE4_RULE_PACKS.find(pack => pack.id.endsWith('.value-flow'));
  const rule = flowPack.rules.find(item => item.id.includes('javascript-0-0-'));
  const only = { ...flowPack, rules: [rule] };
  const findings = executeV3RulePacks([only], { files: [
    file('src/reassigned.ts', 'const value = req.query.id; value = "fixed"; eval(value);'),
    file('tests/unsafe.ts', 'const value = req.query.id; eval(value);'),
    file('src/unrelated.ts', 'const value = "safe"; eval(value);'),
  ], technologies: ['typescript'] }).findings;
  assert.deepEqual(findings, []);
});
test('V3 value-path rules recognize Python and PHP assignment boundaries', () => {
  const pack = V3_PHASE4_RULE_PACKS.find(item => item.id.endsWith('.value-flow'));
  const selected = { ...pack, rules: pack.rules.filter(item => /(?:python|php)-0-0-/.test(item.id)) };
  assert.equal(selected.rules.length, 2);
  const findings = executeV3RulePacks([selected], {
    files: [file('src/app.py', "user = request.args.get('name')\neval(user)\n"),
      file('src/app.php', "$user = $_GET['name'];\neval($user);\n")],
    technologies: ['python', 'php'],
  }).findings;
  assert.ok(findings.some(item => item.file === 'src/app.py'));
  assert.ok(findings.some(item => item.file === 'src/app.php'));
  assert.ok(findings.every(item => item.severity === 'warning' && item.confidence === 'review-required'));
});
test('V3 Phase 3 compatibility signals include real evidence and avoid stable versions', () => {
  const files = [pkg('package.json', { 'react-native': 'canary', electron: '^30.1.0' }), file('pubspec.yaml', 'name: example\ndependencies:\n  flutter: any\n  riverpod: latest\n'), file('Cargo.toml', '[dependencies]\ntauri = "latest"\n'), file('manifest.json', '{"manifest_version": 2}')];
  const result = executeV3RulePacks(V3_PHASE3_RULE_PACKS, { files, technologies: ['react-native', 'electron', 'flutter', 'riverpod', 'tauri', 'browser-extension'] });
  assert.ok(result.findings.some(f => f.ruleId.includes('react-native') && f.file === 'package.json'));
  assert.ok(result.findings.some(f => f.file === 'pubspec.yaml' && f.ruleId.includes('riverpod')));
  assert.ok(result.findings.some(f => f.file === 'Cargo.toml' && f.ruleId.includes('tauri')));
  assert.ok(result.findings.some(f => f.ruleId.endsWith('migration.manifest-v2')));
  assert.ok(!result.findings.some(f => f.file === 'package.json' && f.ruleId.includes('electron')));
  assert.ok(result.findings.every(f => f.confidence === 'review-required'));
  const negative = executeV3RulePacks(V3_PHASE3_RULE_PACKS, { files: [file('tests/manifest.json', '{"manifest_version": 2}'), pkg('package.json', { electron: '^30.1.0' })], technologies: ['electron', 'browser-extension'] });
  assert.ok(!negative.findings.length);
});
test('V3 Phase 3 migration signatures detect legacy platform syntax without claiming exploitability', () => {
  const files = [file('lib/main.dart', 'RaisedButton(onPressed: go);'), file('src/main.js', "const old = require('electron').remote;"), file('deploy.yaml', 'apiVersion: apps/v1beta1\nkind: Deployment'), file('serverless.yml', 'provider:\n  runtime: nodejs12.x')];
  const result = executeV3RulePacks(V3_PHASE3_RULE_PACKS, { files, technologies: ['flutter', 'electron', 'kubernetes', 'serverless'] });
  for (const id of ['flutter-raised-button', 'electron-remote', 'deployment-v1beta1', 'lambda-node12'])
    assert.ok(result.findings.some(f => f.ruleId.endsWith(`migration.${id}`)), `missing ${id}`);
  assert.ok(result.findings.filter(f => f.ruleId.includes('.migration.')).every(f => f.confidence === 'review-required' && f.evidence.length));
});
test('V3 Phase 2 covers every promised core ecosystem and intelligence boundary', () => {
  const rules = V3_PHASE2_RULE_PACKS.flatMap(pack => pack.rules);
  const technologies = new Set(rules.flatMap(rule => rule.technologies.map(item => item.toLowerCase())));
  for (const technology of ['javascript', 'typescript', 'python', 'java', 'kotlin', 'c', 'c++', 'c#', 'go', 'rust', 'php', 'react', 'next.js', 'vue', 'angular', 'svelte', 'node.js', 'jvm', '.net', 'html', 'docker', 'github-actions']) {
    assert.ok(technologies.has(technology), `missing Phase 2 technology: ${technology}`);
  }
  const modules = new Set(rules.map(rule => rule.module));
  for (const module of ['technology', 'dependency', 'security', 'browser', 'api', 'deployment', 'accessibility']) assert.ok(modules.has(module), `missing Phase 2 module: ${module}`);
  assert.ok(V3_PHASE2_RULE_PACKS.length >= 10);
});
test('V3 Phase 2 fixtures separate evidence from vulnerability claims', () => {
  const files = [file('src/server.py', 'result = pickle.loads(payload)'), file('tests/server.py', 'eval(test_input)'), pkg('package.json', { react: 'latest' })];
  const result = executeV3RulePacks(V3_PHASE2_RULE_PACKS, { files, technologies: ['python', 'react'] });
  const pickle = result.findings.find(item => item.ruleId.includes('python-sensitive-api.pickle-loads'));
  assert.ok(pickle); assert.equal(pickle.confidence, 'review-required'); assert.equal(pickle.file, 'src/server.py');
  assert.ok(!result.findings.some(item => item.file === 'tests/server.py'));
  assert.ok(result.findings.some(item => item.ruleId.endsWith('.mutable') && item.file === 'package.json'));
  const pinned = executeV3RulePacks(V3_PHASE2_RULE_PACKS, { files: [pkg('package.json', { react: '^18.3.1' })], technologies: ['react'] });
  assert.ok(!pinned.findings.some(item => item.ruleId.endsWith('.mutable')));
});
test('V3 Phase 2 parses JVM, NuGet and native dependency manifests', () => {
  const files = [
    file('pom.xml', '<project><dependencies><dependency><groupId>org.springframework</groupId><artifactId>spring-core</artifactId><version>latest</version></dependency></dependencies></project>'),
    file('App.csproj', '<Project><ItemGroup><PackageReference Include="Newtonsoft.Json" Version="latest" /></ItemGroup></Project>'),
    file('vcpkg.json', JSON.stringify({ dependencies: [{ name: 'boost', version: 'latest' }] })),
  ];
  const result = executeV3RulePacks(V3_PHASE2_RULE_PACKS, { files, technologies: ['jvm', 'dotnet', 'native-c-cpp'] });
  for (const manifest of ['pom.xml', 'App.csproj', 'vcpkg.json']) assert.ok(result.findings.some(item => item.file === manifest && item.ruleId.endsWith('.mutable')), `missing mutable dependency evidence for ${manifest}`);
});
test('V3 Phase 2 generated catalog matches the executable inventory', () => {
  const catalog = fs.readFileSync(path.join(root, 'docs/generated/V3_PHASE2_RULES.md'), 'utf8');
  assert.ok(catalog.includes('- Total core inventory: 3,000'));
  for (const pack of V3_PHASE2_RULE_PACKS) assert.ok(catalog.includes(`\`${pack.id}\``), `generated catalog missing ${pack.id}`);
  assert.equal((catalog.match(/^\| `(?:technology|dependency|security|browser|api|deployment|accessibility)\./gm) ?? []).length, V3_PHASE2_RULE_COUNT);
});
test('malformed package manifests do not crash', () => assert.deepEqual(detectRegisteredTechnologies([file('package.json', '{bad')]).filter(x => x.kind !== 'runtime'), []));
test('multiple workspace technologies coexist', () => {
  const ids = detectRegisteredTechnologies([pkg('apps/web/package.json', { react: '18' }), pkg('apps/api/package.json', { express: '4' })]).map(x => x.id);
  assert.ok(ids.includes('react') && ids.includes('express'));
});
test('repeated dependencies do not inflate confidence', () => {
  const one = detectRegisteredTechnologies([pkg('package.json', { react: '18' })]).find(x => x.id === 'react');
  const many = detectRegisteredTechnologies(Array.from({length: 30}, (_, i) => pkg('packages/p' + i + '/package.json', { react: '18' }))).find(x => x.id === 'react');
  assert.equal(one.confidence, many.confidence);
  assert.ok(many.evidence.length <= 8);
});
for (const scope of ['tests', 'fixtures', 'vendor', 'generated', 'docs']) {
  test('exclude ' + scope + ' technology evidence', () => assert.deepEqual(detectRegisteredTechnologies([pkg(scope + '/package.json', { react: '18', pg: '8' })]), []));
}
test('Windows test paths are classified', () => assert.equal(classifyProjectFileScope('tests\\\\unit\\\\file.ts'), 'test'));
test('plain Dart does not imply Flutter', () => assert.ok(!detectRegisteredTechnologies([file('pubspec.yaml', 'name: plain_dart')]).some(x => x.id === 'flutter')));
test('knowledge does not inspect arbitrary prose', () => assert.deepEqual(detectRegisteredTechnologies([file('README.md', 'react pg prisma')]), []));
for (const definition of TECHNOLOGY_KNOWLEDGE) {
  test('dependency fixture: ' + definition.id, () => {
    const detected = detectRegisteredTechnologies([pkg('package.json', { [definition.dependencies[0]]: '1.0.0' })]);
    const match = detected.find(x => x.id === definition.id);
    assert.ok(match);
    assert.equal(match.level, 'likely');
    assert.equal(match.evidence[0].source, 'package.json');
    const negative = detectRegisteredTechnologies([pkg('package.json', { ['not-' + definition.dependencies[0]]: '1.0.0' })]);
    assert.ok(!negative.some(x => x.id === definition.id));
  });
}
for (const [extension, language] of Object.entries(ADDITIONAL_LANGUAGE_EXTENSIONS)) {
  test('language fixture: ' + extension, () => {
    const profiles = detectLanguageProfile([file('src/main' + extension, 'source'), file('vendor/huge.py', 'x'.repeat(1000))]);
    assert.equal(profiles[0].language, language);
    assert.equal(profiles.length, 1);
    assert.equal(classifyProject([file('src/main' + extension, 'source')], []).isSoftware, true);
    assert.equal(detectLanguage([], [file('src/main' + extension, 'source')]), language);
  });
}
test('large JSON payload does not change Node runtime', () => {
  const files = [pkg('package.json', {react: '18'}), file('src/app.js', 'const app = 1'), file('data.json', 'x'.repeat(100000))];
  const stack = detectStack(files, parseFiles(files));
  assert.equal(stack.language, 'JavaScript');
  assert.equal(stack.runtime, 'Node.js');
});
test('kernel projects prefer root Kbuild evidence over nested Python tooling', () => {
  const files = [
    file('Makefile', 'VERSION = 6\n'), file('Kbuild', 'obj-y += kernel/\n'), file('Kconfig', 'mainmenu "Kernel"\n'),
    file('arch/x86/kernel/setup.c', 'int setup_arch(void) { return 0; }'), file('drivers/net/core.c', 'int driver_init(void) { return 0; }'),
    file('kernel/sched/core.c', 'int schedule(void) { return 0; }'), file('include/linux/kernel.h', '#define KERNEL 1'), file('mm/page_alloc.c', 'int alloc_page(void) { return 0; }'),
    file('tools/net/ynl/pyproject.toml', '[build-system]\nrequires=["setuptools"]\n[project]\nname="pyynl"'),
    file('README', 'Kernel project'), file('COPYING', 'GPL-2.0-only'), file('.gitignore', '*.o'), file('.editorconfig', 'root = true'),
    file('Documentation/process/security-bugs.rst', 'Security bugs'),
  ];
  const parsed = parseFiles(files); const stack = detectStack(files, parsed);
  assert.equal(stack.language, 'C'); assert.equal(stack.framework, 'Unknown'); assert.equal(stack.runtime, 'Unknown');
  assert.equal(stack.packageManager, 'Unknown'); assert.equal(stack.buildTool, 'Kbuild'); assert.equal(stack.database, 'Unknown');
  const intelligence = detectTechnologyIntelligence(files, parsed, stack);
  assert.equal(intelligence.architecture.primary, 'Operating System Kernel');
  const extended = detectExtendedIntelligence(files, { ...stack, architecture: intelligence.architecture, technologyDetections: detectRegisteredTechnologies(files), runtimes: [] });
  assert.equal(extended.modules.license.metrics.licenseFile, true); assert.equal(extended.modules.documentation.metrics.readme, true);
  assert.equal(extended.modules.repository.metrics.gitignore, true); assert.equal(extended.modules.repository.metrics.securityPolicy, true);
});
test('auxiliary tooling detections do not become project-wide runtime relationships', () => {
  const files = [
    file('Makefile', 'VERSION = 6\n'), file('Kbuild', 'obj-y += kernel/\n'), file('Kconfig', 'mainmenu "Kernel"\n'),
    file('arch/x.c', 'int x;'), file('drivers/y.c', 'int y;'), file('kernel/z.c', 'int z;'), file('include/linux/a.h', '#define A 1'),
    file('tools/net/ynl/pyproject.toml', '[project]\nname="pyynl"'),
  ];
  const parsed = parseFiles(files); const stack = detectStack(files, parsed); const detections = detectRegisteredTechnologies(files);
  const profiles = detectTechnologyProfiles(files, parsed, stack, detections);
  assert.ok(!profiles.runtimes.includes('Python'));
  const graph = buildTechnologyGraph(detections);
  assert.ok(!graph.relationships.some((item) => item.type === 'runs-on' && /python/i.test(item.to)));
});
test('security transport and JWT rules require executable context', () => {
  const falsePositive = detectSecurityIntelligence([
    file('include/linux/mtd/pismo.h', '/* PISMO memory driver - http://www.pismoworld.org/ */'),
    file('src/state.py', 'value = buffer.decode()'),
  ]);
  assert.ok(!falsePositive.findings.some((item) => item.ruleId === 'SEC005' || item.ruleId === 'SEC024'));
  const jwt = detectSecurityIntelligence([file('src/auth.py', 'import jwt\nclaims = jwt.decode(token, key)')]);
  assert.ok(jwt.findings.some((item) => item.ruleId === 'SEC024'));
});
function manifest(ecosystem, name) {
  if (ecosystem === 'python') return file('requirements.txt', name + '>=1.0');
  if (ecosystem === 'cargo') return file('Cargo.toml', '[dependencies]\n' + name + ' = "1.0"');
  if (ecosystem === 'go') return file('go.mod', 'require ' + name + ' v1.0.0');
  return file('composer.json', JSON.stringify({ require: { [name]: '^1.0' } }));
}
for (const definition of ECOSYSTEM_KNOWLEDGE) {
  const signal = definition.ecosystemDependencies[0];
  test('ecosystem fixture: ' + definition.id, () => {
    const fixture = manifest(signal.ecosystem, signal.name);
    assert.ok(detectRegisteredTechnologies([fixture]).some(x => x.id === definition.id));
    assert.ok(!detectRegisteredTechnologies([pkg('package.json', { [signal.name]: '1' })]).some(x => x.id === definition.id));
    assert.ok(!detectRegisteredTechnologies([{ ...fixture, path: 'fixtures/' + fixture.path }]).some(x => x.id === definition.id));
    assert.ok(!detectRegisteredTechnologies([manifest(signal.ecosystem, 'not-' + signal.name)]).some(x => x.id === definition.id));
  });
}
test('requirements ignores comments, includes and URLs', () => {
  const result = collectEcosystemDependencies([file('requirements-dev.txt', '# torch\n-r torch\nhttps://example.com/torch\nSCIKIT_LEARN[extra]>=1 # comment\n')]);
  assert.deepEqual(result.map(x => x.name), ['scikit-learn']);
});
test('Cargo handles aliases and ignores package metadata', () => {
  const result = collectEcosystemDependencies([file('Cargo.toml', '[package]\nname = "tokio"\n[dependencies]\nasync_rt = { package = "tokio", version = "1" }\n# serde = "1"')]);
  assert.deepEqual(result.map(x => x.name), ['tokio']);
});
test('pyproject reads PEP 621 and Poetry dependency declarations', () => {
  const result = collectEcosystemDependencies([file('pyproject.toml', '[project]\ndependencies = [\n "FastAPI>=1",\n "SCIKIT_LEARN[extra]>=1"\n]\n[tool.poetry.dependencies]\npython = "^3.12"\nDjango = "^5"')]);
  assert.deepEqual(result.map(item => item.name), ['fastapi', 'scikit-learn', 'django']);
});
test('Cargo reads workspace, target and dependency-table declarations', () => {
  const result = collectEcosystemDependencies([file('Cargo.toml', '[workspace.dependencies]\nserde = "1"\n[target.\'cfg(unix)\'.dependencies]\ntokio = "1"\n[dependencies.reqwest]\nversion = "1"')]);
  assert.deepEqual(result.map(item => item.name), ['serde', 'tokio', 'reqwest']);
});
test('Go require blocks exclude replace directives', () => {
  const result = collectEcosystemDependencies([file('go.mod', 'require (\n go.uber.org/zap v1.0.0 // indirect\n)\nreplace github.com/spf13/cobra => ./local')]);
  assert.deepEqual(result.map(x => x.name), ['go.uber.org/zap']);
});
test('Composer metadata is not dependency evidence', () => {
  const result = collectEcosystemDependencies([file('composer.json', '{"description":"phpunit/phpunit","require-dev":{"pestphp/pest":"^1"}}')]);
  assert.deepEqual(result.map(x => x.name), ['pestphp/pest']);
});
test('malformed Composer input is safe', () => assert.deepEqual(collectEcosystemDependencies([file('composer.json', 'null'), file('apps/api/composer.json', '{')]), []));
test('browser feature knowledge has unique ids and broad Phase 3 coverage', () => {
  assert.equal(new Set(BROWSER_FEATURES.map(item => item.id)).size, BROWSER_FEATURES.length);
  assert.ok(BROWSER_FEATURES.length >= 100);
});
test('browser targets resolve from package browserslist with provenance', () => {
  const result = resolveBrowserTargets([file('package.json', JSON.stringify({ browserslist: { production: ['chrome >= 100', 'firefox 110', 'safari >= 15.4', 'edge 100'] } }))]);
  assert.equal(result.source, 'package.json#browserslist'); assert.equal(result.usedDefaults, false); assert.equal(result.targets.length, 4);
});
test('browserslistrc exact targets override package targets', () => {
  const result = resolveBrowserTargets([file('.browserslistrc', '[production]\nchrome 90\nsafari >= 14'), file('package.json', JSON.stringify({ browserslist: ['chrome 120'] }))]);
  assert.deepEqual(result.targets, [{ browser: 'Chrome', version: 90 }, { browser: 'Safari', version: 14 }]); assert.equal(result.source, '.browserslistrc');
});
test('unsupported web platform features are tied to configured targets', () => {
  const result = detectBrowserCompatibility([file('.browserslistrc', 'chrome 100\nfirefox 120\nsafari 16\nedge 100'), file('src/app.ts', 'navigator.gpu; navigator.bluetooth; structuredClone(value);')]);
  assert.ok(result.findings.some(item => item.id === 'webgpu' && item.affectedBrowsers.length === 4));
  assert.ok(result.findings.some(item => item.id === 'web-bluetooth' && item.affectedBrowsers.includes('Safari')));
  assert.ok(!result.findings.some(item => item.id === 'structured-clone'));
});
test('browser intelligence excludes test, fixture and generated code', () => {
  const result = detectBrowserCompatibility([file('tests/app.ts', 'navigator.gpu'), file('testing/app.ts', 'navigator.gpu'), file('e2e/app.ts', 'navigator.gpu'), file('fixtures/app.ts', 'navigator.gpu'), file('generated/app.ts', 'navigator.gpu')]);
  assert.equal(result.filesScanned, 0); assert.deepEqual(result.findings, []);
});
test('security registry is valid and expands Phase 3 coverage', () => {
  assert.deepEqual(validateSecurityRules(), []); assert.ok(SECURITY_RULES.length >= 20);
  assert.ok(validateSecurityRules([{ ...SECURITY_RULES[0], id: 'SEC099', severity: 'critical' }]).some(error => error.includes('Regex-only')));
});
test('security findings include category, confidence and safe evidence', () => {
  const result = detectSecurityIntelligence([file('src/server.ts', 'const password = "real-production-secret";\nconst agent = { rejectUnauthorized: false };')]);
  assert.ok(result.findings.some(item => item.ruleId === 'SEC001' && item.category === 'secrets' && item.confidence));
  assert.ok(result.findings.some(item => item.ruleId === 'SEC010' && item.category === 'transport'));
  assert.ok(result.findings.every(item => !item.evidence.includes('real-production-secret')));
  assert.ok(result.categoryCounts.secrets >= 1); assert.equal(result.knowledgeVersion, '4.1.0');
});
test('security placeholders and local HTTP endpoints are suppressed', () => {
  const result = detectSecurityIntelligence([file('src/config.ts', 'const apiKey = "replace-me"; const backupApiKey = "fake-api-key-for-testing"; const url = "http://localhost:3000/api";')]);
  assert.deepEqual(result.findings, []);
});
test('credential-like regex matches are review warnings rather than automatic critical findings', () => {
  const finding = detectSecurityIntelligence([file('src/config.ts', 'const apiKey = "plausible-production-value";')]).findings[0];
  assert.equal(finding.ruleId, 'SEC001'); assert.equal(finding.severity, 'warning'); assert.equal(finding.certainty, 'likely');
});
test('private-key generation markers are not treated as embedded private keys', () => {
  const generated = 'return `-----BEGIN OPENSSH PRIVATE KEY-----\\n${lines.join("\\n")}\\n-----END OPENSSH PRIVATE KEY-----\\n`;';
  assert.ok(!detectSecurityIntelligence([file('src/keys.ts', generated)]).findings.some(item => item.ruleId === 'SEC008'));
  const embedded = 'const key = `-----BEGIN PRIVATE KEY-----\nQUJDREVGR0hJSktMTU5PUA==\nUVJTVFVWV1hZWjEyMzQ1Ng==\n-----END PRIVATE KEY-----`;';
  assert.ok(detectSecurityIntelligence([file('src/leaked.ts', embedded)]).findings.some(item => item.ruleId === 'SEC008' && item.severity === 'warning' && item.certainty === 'review-required'));
});
test('security rules are language scoped', () => {
  const result = detectSecurityIntelligence([file('src/app.py', 'eval(data)\nconst x = { rejectUnauthorized: false }')]);
  assert.ok(!result.findings.some(item => item.ruleId === 'SEC002' || item.ruleId === 'SEC010'));
});
test('process execution rule does not confuse RegExp.exec with child processes', () => {
  const result = detectSecurityIntelligence([file('src/matcher.ts', 'const match = regex.exec(source);')]);
  assert.ok(!result.findings.some(item => item.ruleId === 'SEC003'));
});
test('script-style test files are excluded from production security findings', () => {
  assert.equal(isNonProductionPath('scripts/test-knowledge.mjs'), true);
  assert.equal(detectSecurityIntelligence([file('scripts/test-security.mjs', 'eval(input)')]).findings.length, 0);
});
test('security intelligence excludes non-production paths cross-platform', () => {
  for (const path of ['tests/app.ts', 'testing/server.ts', 'e2e/app.ts', 'docs/example.py', 'vendor/app.php', 'src\\fixtures\\app.ts']) assert.equal(isNonProductionPath(path), true);
  const result = detectSecurityIntelligence([file('examples/server.ts', 'const password = "real-production-secret"')]); assert.deepEqual(result.findings, []);
});
test('unsafe deserialization rules distinguish safe YAML loading', () => {
  const result = detectSecurityIntelligence([file('src/unsafe.py', 'pickle.loads(payload)\nyaml.load(payload)\nyaml.load(payload, Loader=yaml.SafeLoader)')]);
  assert.ok(result.findings.some(item => item.ruleId === 'SEC015')); assert.equal(result.findings.filter(item => item.ruleId === 'SEC016').length, 1);
});
test('API intelligence covers file and framework routes', () => {
  const result = detectCodeIntelligence([
    file('app/api/users/[id]/route.ts', 'export async function GET() {}\nexport function DELETE() {}'),
    file('api.py', '@app.post("/items")\ndef create(): pass'),
    file('UserController.java', '@GetMapping("/users")\nvoid users() {}'),
    file('routes/web.php', "Route::put('/profile', handler);"),
    file('server.go', 'http.HandleFunc("/health", health)'),
  ]);
  for (const route of ['/api/users/:id', '/items', '/users', '/profile', '/health']) assert.ok(result.apiEndpoints.some(item => item.route === route));
  assert.ok(result.frameworksCovered.length >= 5);
});
test('large functions use function span rather than containing file size', () => {
  const manyLines = Array.from({ length: 300 }, (_, index) => `const value${index} = ${index};`).join('\n');
  const result = detectCodeIntelligence([file('src/large.ts', `function tiny() { return 1; }\n${manyLines}`)]);
  assert.equal(result.quality.largeFiles.length, 0); assert.equal(result.quality.largeFunctions.length, 0);
  const largeBody = Array.from({ length: 85 }, () => 'work();').join('\n');
  assert.equal(detectCodeIntelligence([file('src/function.ts', `function huge() {\n${largeBody}\n}`)]).quality.largeFunctions[0].lines, 87);
});
test('Code Intelligence 2.0 reports calls, complexity, duplicates and module boundaries', () => {
  const branchy = `export function calculate(value) {\n${Array.from({ length: 12 }, (_, index) => `if (value === ${index}) helper();`).join('\n')}\n}\nfunction helper() { return 1; }`;
  const duplicate = `export function shared() {\n  const alpha = normalize(input);\n  const beta = validate(alpha);\n  const gamma = transform(beta);\n  const delta = serialize(gamma);\n  return publish(delta);\n  audit(delta);\n}`;
  const result = detectCodeIntelligence([file('src/ui/page.ts', branchy), file('src/backend/service.ts', duplicate), file('src/ui/copy.ts', duplicate), file('src/orphan.ts', 'export const orphan = true;')]);
  assert.ok(result.callRelationships.some(item => item.callee === 'helper'));
  assert.ok(result.quality.complexity.some(item => item.symbol === 'calculate'));
  assert.ok(result.quality.duplicateCode.length >= 1);
  assert.ok(result.quality.unreferencedModules.includes('src/orphan.ts'));
  assert.ok(result.parserCoverage['JavaScript/TypeScript'] >= 4);
});
test('mobile browser targets remain distinct and findings state static-check limitation', () => {
  const targets = resolveBrowserTargets([file('.browserslistrc', 'and_chr 100\nios_saf 15')]).targets;
  assert.deepEqual(targets.map(item => item.browser), ['Chrome Android', 'Safari iOS']);
  const result = detectBrowserCompatibility([file('.browserslistrc', 'ios_saf 15'), file('src/app.ts', 'navigator.gpu')]);
  assert.equal(result.findings[0].staticCheckOnly, true);
});
test('security configuration rules include scope and false-positive metadata', () => {
  const result = detectSecurityIntelligence([file('deploy.yaml', 'securityContext:\n  privileged: true')]);
  const finding = result.findings.find(item => item.ruleId === 'SEC032');
  assert.equal(finding.scope, 'configuration'); assert.equal(finding.certainty, 'review-required'); assert.equal(finding.falsePositivePossible, true);
});
test('incremental manifests distinguish reusable and changed files', () => {
  const make = (files) => ({ fileName: 'project', files, source: 'upload', scanStats: { filesFound: files.length, filesAnalyzed: files.length, filesIgnored: 0, foldersFound: 0, projectSize: 1, zipSize: 1, scanTime: 1, memoryUsed: 1, truncated: false } });
  const diff = diffAnalysisInputs(make([file('a.ts', 'one'), file('b.ts', 'two')]), make([file('a.ts', 'one'), file('b.ts', 'changed'), file('c.ts', 'new')]));
  assert.deepEqual(diff.added, ['c.ts']); assert.deepEqual(diff.changed, ['b.ts']); assert.deepEqual(diff.unchanged, ['a.ts']); assert.equal(diff.reusableRatio, 1 / 3);
});
test('Architecture Intelligence 2.0 recognizes evidence-backed compound patterns', () => {
  const files = [pkg('services/web/package.json', { react: '18' }), pkg('services/api/package.json', { express: '4', bullmq: '5' }), pkg('services/jobs/package.json', { bullmq: '5' }), file('serverless.yml', 'service: api'), file('workers/email.ts', 'export const worker = true')];
  const detected = parseFiles(files); const stack = detectStack(files, detected);
  const architecture = detectTechnologyIntelligence(files, detected, stack).architecture;
  for (const pattern of ['Microservices', 'Event-driven', 'Background Workers']) assert.ok(architecture.patterns.includes(pattern), `${pattern}: ${architecture.patterns.join(', ')}`);
});
test('architecture detection excludes test and fixture manifests', () => {
  const files = [
    pkg('package.json', { react: '18' }),
    pkg('e2e-tests/fixtures/services/web/package.json', { react: '18' }),
    pkg('e2e-tests/fixtures/services/api/package.json', { express: '4' }),
    pkg('e2e-tests/fixtures/services/jobs/package.json', { bullmq: '5' }),
  ];
  const detected = parseFiles(files); const stack = detectStack(files, detected);
  const architecture = detectTechnologyIntelligence(files, detected, stack).architecture;
  assert.ok(!architecture.patterns.includes('Microservices'), architecture.patterns.join(', '));
});
test('repeated informational security matches have a bounded score penalty', () => {
  const files = Array.from({ length: 100 }, (_, index) => file(`src/module-${index}.ts`, 'console.log("diagnostic");'));
  const result = detectSecurityIntelligence(files);
  assert.ok(result.findings.length >= 100);
  assert.ok(result.score >= 95, `security score was ${result.score}`);
});
test('catalog has unique visible cards within every section', () => {
  const keys = UCE_CATALOG_ITEMS.map((item) => `${item.section}:${item.name.trim().toLocaleLowerCase()}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(new Set(UCE_CATALOG_ITEMS.map((item) => item.id)).size, UCE_CATALOG_ITEMS.length);
});
test('dependency intelligence correlates workspace conflicts and mutable sources', () => {
  const result = detectDependencyIntelligence([
    file('package.json', JSON.stringify({ dependencies: { react: '^18', loose: '*', remote: 'git+https://example.com/repo.git' } })),
    file('packages/app/package.json', JSON.stringify({ dependencies: { react: '^19' } })),
    file('fixtures/package.json', JSON.stringify({ dependencies: { ignored: 'latest' } })),
  ], { packageManager: 'pnpm' });
  assert.equal(result.manifestsScanned, 2); assert.equal(result.versionConflicts.length, 1);
  assert.deepEqual(new Set(result.risks.map(item => item.kind)), new Set(['wildcard', 'remote-source', 'version-conflict']));
  assert.ok(!result.risks.some(item => item.name === 'ignored'));
});
test('correlated intelligence prioritizes cross-engine signals', () => {
  const insights = buildCorrelatedInsights({
    securityIntelligence: { findings: [{ id: 'x', ruleId: 'SEC008', title: 'secret', severity: 'critical', confidence: 'high', certainty: 'confirmed', file: 'src/a.ts', line: 1, evidence: 'safe', recommendation: 'fix' }], score: 0, filesScanned: 1, rulesExecuted: 1 },
    browserCompatibility: { targets: [], findings: [{ feature: 'WebGPU', kind: 'web-api', file: 'src/a.ts', line: 2, status: 'unsupported', affectedBrowsers: ['Safari'], recommendation: 'fallback' }], score: 80, filesScanned: 1, featuresChecked: 25 },
    dependencyIntelligence: { manager: 'pnpm', total: 1, runtime: 1, development: 0, peer: 0, optional: 0, dependencies: [], duplicateNames: [], versionConflicts: [], risks: [{ name: 'x', version: '*', source: 'package.json', kind: 'wildcard', severity: 'warning', recommendation: 'pin' }], healthScore: 90 },
  });
  assert.equal(insights[0].severity, 'critical'); assert.ok(insights.some(item => item.domain === 'browser')); assert.ok(insights.some(item => item.domain === 'dependencies'));
});
test('browser compatibility distinguishes partial support', () => {
  const result = detectBrowserCompatibility([file('.browserslistrc', 'chrome 115'), file('src/style.css', '.card { & .title { color: red; } }')]);
  assert.equal(result.findings.find(item => item.id === 'css-nesting').status, 'partial');
});
const extendedStack = {
  language: 'TypeScript', primaryLanguage: 'TypeScript', runtime: 'Node.js', runtimes: ['Node.js'], packageManager: 'pnpm', buildTool: 'Vite',
  technologyDetections: [{ id: 'postgres', name: 'PostgreSQL', kind: 'database', confidence: 90, level: 'confirmed', evidence: [] }],
  architecture: { primary: 'SPA', patterns: ['SPA'], confidence: 90, evidence: ['Vite app'] },
  codeIntelligence: { filesAnalyzed: 3, symbols: [], dependencyEdges: [], apiEndpoints: [{ method: 'GET', route: '/api/users', file: 'src/api.ts', line: 1, framework: 'Express' }], entryPoints: [], architectureAreas: {}, quality: { largeFiles: [], largeFunctions: [], todoCount: 0, fixmeCount: 0, circularDependencies: [] } },
};
test('Phase 3.5 exposes every planned intelligence module', () => {
  const intelligence = detectExtendedIntelligence([file('src/app.ts', 'export const app = 1')], extendedStack);
  assert.equal(Object.keys(intelligence.modules).length, 14); assert.equal(intelligence.version, '3.5.1'); assert.ok(intelligence.overallScore >= 0);
  for (const id of ['project', 'runtime', 'platform', 'build', 'testing', 'performance', 'accessibility', 'api', 'database', 'environment', 'license', 'documentation', 'maintainability', 'repository']) assert.equal(intelligence.modules[id].id, id);
});
test('accessibility intelligence finds deterministic HTML and JSX problems', () => {
  const module = detectExtendedIntelligence([file('src/App.tsx', '<div onClick={go}><img src="x.png" /><a target="_blank">Open</a></div>')], extendedStack).modules.accessibility;
  assert.deepEqual(new Set(module.findings.map(item => item.id)), new Set(['A11Y001', 'A11Y003', 'A11Y004']));
});
test('environment intelligence compares usage with safe example declarations', () => {
  const module = detectExtendedIntelligence([file('.env.example', 'PUBLIC_URL=\n'), file('src/config.ts', 'const a = process.env.PUBLIC_URL; const b = process.env.SECRET_TOKEN;')], extendedStack).modules.environment;
  assert.equal(module.metrics.requiredVariables, 2); assert.equal(module.metrics.undocumentedVariables, 1); assert.ok(module.findings[0].title.includes('SECRET_TOKEN'));
});
test('testing, license, documentation and repository readiness are evidence based', () => {
  const files = [file('src/a.ts', 'export const a=1'), file('src/a.test.ts', 'test("a",()=>{})'), file('LICENSE', 'Apache License'), file('.gitignore', 'node_modules'), file('.github/workflows/ci.yml', 'jobs: {}'), file('README.md', '# App\n## Installation\n## Usage\n## Configuration\n## License')];
  const intelligence = detectExtendedIntelligence(files, extendedStack);
  assert.equal(intelligence.modules.testing.metrics.testFiles, 1); assert.equal(intelligence.modules.license.metrics.licenseFile, true); assert.equal(intelligence.modules.documentation.metrics.sections, 4); assert.equal(intelligence.modules.repository.metrics.workflows, true);
});
test('performance, platform, database and maintainability emit bounded findings', () => {
  const repeated = 'const repeatedValue = calculateSomething();\n'.repeat(6); const files = [file('src/a.ts', `${repeated}const x = readFileSync(path); const p = "C:\\\\temp";`), file('src/b.ts', repeated), file('schema.prisma', 'model User { id Int @id }'), file('migrations/001.sql', 'CREATE TABLE users(id int);')];
  const intelligence = detectExtendedIntelligence(files, extendedStack);
  assert.ok(intelligence.modules.performance.findings.some(item => item.id === 'PERF002')); assert.ok(intelligence.modules.platform.findings.some(item => item.id === 'OS001')); assert.ok(Number(intelligence.modules.database.metrics.schemaModels) >= 1); assert.ok(Number(intelligence.modules.maintainability.metrics.duplicatedBlocks) >= 1);
});
test('repeated quality signals do not collapse module scores and test files are excluded', () => {
  const files = [
    ...Array.from({ length: 100 }, (_, index) => file(`src/module-${index}.ts`, 'const data = readFileSync(path);')),
    file('testing/blocking.ts', 'const data = readFileSync(path);'),
  ];
  const module = detectExtendedIntelligence(files, extendedStack).modules.performance;
  assert.equal(module.findings.length, 100); assert.ok(module.score >= 80, `performance score was ${module.score}`);
});
test('documentation intelligence prefers the root README over nested test documentation', () => {
  const module = detectExtendedIntelligence([
    file('testing/README.md', '# Fixture'),
    file('README.md', '# Project\n## Installation\n## Usage\n## Configuration\n## License'),
  ], extendedStack).modules.documentation;
  assert.equal(module.metrics.sections, 4); assert.equal(module.findings.length, 0);
});
const workspaceReport = (id, issueTitles, score = 80, createdAt = '2026-01-01T00:00:00.000Z') => ({
  id, createdAt, analysisVersion: '2.0.0', source: 'upload', classification: { type: 'Software Project', isSoftware: true, reason: 'source' },
  summary: { name: 'workspace-app', language: 'TypeScript', framework: 'React', runtime: 'Node.js', packageManager: 'pnpm', detectedConfigFiles: [], filesScanned: 1, foldersScanned: 1, scanStats: { projectSize: 1, filesFound: 1, filesAnalyzed: 1, filesIgnored: 0, ignoredCategories: [] } },
  stack: { language: 'TypeScript', framework: 'React', runtime: 'Node.js', packageManager: 'pnpm', buildTool: 'Vite', frontend: 'React', backend: 'None', database: 'Unknown', configFiles: [], securityIntelligence: { score: 50, filesScanned: 1, rulesExecuted: 1, findings: [{ id: 'secret', ruleId: 'SEC001', title: 'Secret signal', category: 'secrets', confidence: 'high', severity: 'critical', file: 'src/a.ts', line: 1, evidence: 'safe evidence', recommendation: 'Review secret' }] }, browserCompatibility: { targets: [], score: 80, filesScanned: 1, featuresChecked: 1, findings: [{ id: 'webgpu', feature: 'WebGPU', kind: 'web-api', file: 'src/a.ts', line: 2, status: 'unsupported', affectedBrowsers: ['Safari'], recommendation: 'Add fallback' }] } },
  issues: issueTitles.map((title, index) => ({ id: `${id}-${index}`, title, category: 'runtime', severity: index ? 'warning' : 'critical', description: title, reason: 'evidence', recommendation: `Fix ${title}`, affectedFile: `src/${index}.ts` })),
  categories: [{ id: 'runtime', label: 'Runtime', status: 'warning', score, issues: [], summary: 'runtime' }], score: { runtime: score, dependencies: score, configuration: score, structure: score, environment: score, security: score, deployment: score, performance: score, overall: score }, detectedFiles: [], timeline: [], notes: [],
});
test('Phase 4 evidence-linked findings appear in Issue Center and retain related files', () => {
  const report = workspaceReport('correlation', []);
  const selected = V3_PHASE4_RULE_PACKS.map(pack => ({ ...pack, rules: pack.rules.filter(item => /manifest-lockfile.*react-/.test(item.id)) })).filter(pack => pack.rules.length);
  report.stack.v3RulePlatform = executeV3RulePacks(selected, {
    files: [pkg('package.json', { react: '18.3.1' }), file('package-lock.json', '{"packages":{"node_modules/react":{"version":"17.0.2"}}}')],
    technologies: ['react'],
  });
  const item = collectWorkspaceFindings(report).find(finding => finding.module === 'v3/dependency');
  assert.ok(item);
  assert.ok(item.evidence.includes('package-lock.json'));
  assert.equal(item.severity, 'warning');
  assert.equal(item.confidence, 'review-required');
});
test('Phase 5 package policy findings appear in Issue Center with their rule IDs', () => {
  const report = workspaceReport('phase5-policy', []);
  const selected = { ...V3_PHASE5_RULE_PACKS[0], rules: [V3_PHASE5_RULE_PACKS[0].rules[0]] };
  const name = selected.rules[0].detectors[0].names[0];
  const policy = V3_PHASE5_POLICIES.find(item => item.id === selected.rules[0].tags.at(-1));
  report.stack.v3RulePlatform = executeV3RulePacks([selected], {
    files: [pkg('package.json', { [name]: policy.example })], technologies: selected.rules[0].technologies,
  });
  const finding = collectWorkspaceFindings(report).find(item => item.ruleId === selected.rules[0].id);
  assert.ok(finding);
  assert.equal(finding.file, 'package.json');
  assert.equal(finding.severity, 'warning');
});
test('Phase 4 workspace unifies compatibility and intelligence findings', () => {
  const report = workspaceReport('one', ['Runtime mismatch']);
  report.issues.push({ id: 'security-intelligence-SEC001', title: 'Secret signal', category: 'security', severity: 'critical', description: 'duplicate bridge', reason: 'evidence', recommendation: 'Review secret', affectedFile: 'src/a.ts' });
  const findings = collectWorkspaceFindings(report);
  assert.deepEqual(new Set(findings.map(item => item.module)), new Set(['runtime', 'security/secrets', 'browser']));
  assert.equal(findings.length, 3);
});
test('Phase 4 similar finding groups remain deterministic', () => {
  const report = workspaceReport('group', ['Repeated issue', 'Repeated issue']);
  report.issues[1].affectedFile = 'src/other.ts';
  report.issues[1].severity = 'critical';
  const groups = groupWorkspaceFindings(collectWorkspaceFindings(report));
  assert.equal(groups.find(item => item.title === 'Repeated issue').findings.length, 2);
});
test('Phase 4 scan comparison tracks new resolved and persisting findings', () => {
  const baseline = workspaceReport('old', ['Persisting', 'Resolved'], 70);
  const current = workspaceReport('new', ['Persisting', 'New'], 85, '2026-02-01T00:00:00.000Z');
  current.issues[0].id = baseline.issues[0].id;
  const comparison = compareReports(current, baseline);
  assert.equal(comparison.scoreDelta, 15);
  assert.ok(comparison.newFindings.some(item => item.title === 'New'));
  assert.ok(comparison.resolvedFindings.some(item => item.title === 'Resolved'));
  assert.ok(comparison.persistingFindings.some(item => item.title === 'Persisting'));
});
test('Phase 4 comparison only offers matching project identities', () => {
  const current = workspaceReport('current', [], 80, '2026-03-01T00:00:00.000Z');
  const older = workspaceReport('older', [], 70, '2026-01-01T00:00:00.000Z');
  const other = workspaceReport('other', [], 90); other.summary.name = 'different-app';
  assert.deepEqual(compatibleProjectReports(current, [current, other, older]).map(item => item.id), ['older']);
});
test('Phase 5 core knowledge pack validates against schema v1', () => {
  const validation = validateKnowledgePack(CORE_KNOWLEDGE_PACK);
  assert.equal(validation.valid, true); assert.equal(validation.signed, false);
  assert.ok(validation.warnings.some(item => item.includes('unsigned')));
  assert.equal(new Set(CORE_KNOWLEDGE_PACK.rules.map(item => item.id)).size, CORE_KNOWLEDGE_PACK.rules.length);
});
test('Phase 5 knowledge pack rejects duplicate rules and unknown permissions', () => {
  const pack = JSON.parse(exportKnowledgePack(CORE_KNOWLEDGE_PACK));
  pack.permissions.push('network-access'); pack.rules.push({ ...pack.rules[0] });
  const validation = validateKnowledgePack(pack);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(item => item.includes('Unsupported permission')));
  assert.ok(validation.errors.some(item => item.includes('Duplicate rule id')));
});
test('Phase 5 knowledge pack import is deterministic and signature-aware', () => {
  const imported = importKnowledgePack(exportKnowledgePack(CORE_KNOWLEDGE_PACK));
  assert.equal(imported.validation.valid, true); assert.equal(imported.pack.id, CORE_KNOWLEDGE_PACK.id);
  assert.equal(importKnowledgePack('{broken').validation.valid, false);
  assert.equal(importKnowledgePack(exportKnowledgePack(CORE_KNOWLEDGE_PACK), true).validation.valid, false);
});
test('Phase 5 trust metadata is local-only and scoring weights are transparent', () => {
  const trust = buildTrustMetadata();
  assert.equal(trust.localOnly, true); assert.equal(trust.networkAccessUsed, false); assert.equal(trust.sourceUploaded, false);
  assert.equal(Math.round(Object.values(trust.scoreWeights).reduce((sum, value) => sum + value, 0) * 100), 100);
  assert.equal(trust.knowledgePacks[0].id, CORE_KNOWLEDGE_PACK.id); assert.ok(trust.knowledgePacks.some((pack) => pack.id === V3_CORE_RULE_PACK.id && pack.schemaVersion === 3));
});
test('Phase 5 execution budgets prioritize source and label truncation accurately', () => {
  const files = [file('assets/blob.txt', 'x'.repeat(50)), file('package.json', '{"dependencies":{"react":"18"}}'), file('src/app.ts', 'export const app=1')];
  const prepared = prepareAnalysisInput({ files, fileName: 'budget', source: 'upload', scanStats: { projectSize: 100, filesFound: 3, filesAnalyzed: 3, filesIgnored: 0, ignoredCategories: [] } }, { maxFiles: 2, maxContentBytes: 100, maxSingleFileBytes: 100 });
  assert.equal(prepared.input.scanStats.sampled, true); assert.equal(prepared.input.scanStats.truncated, true);
  assert.deepEqual(prepared.input.files.map(item => item.path), ['package.json', 'src/app.ts']);
  assert.equal(fingerprintAnalysisInput(prepared.input), fingerprintAnalysisInput(prepared.input));
});
test('Phase 5 detector SDK validates and executes bounded declarative rules', () => {
  const rule = { id: 'org.console-log', title: 'Debug log', severity: 'info', include: ['src/**/*.ts'], pattern: 'console\\.log\\(', message: 'Debug logging found.', recommendation: 'Remove it.', maxFindings: 2 };
  assert.deepEqual(validateDetectorRule(rule), []);
  const findings = runDetectorRules([rule], [file('src/lib/a.ts', 'console.log(1);\nconsole.log(2);\nconsole.log(3);'), file('vendor/a.ts', 'console.log(4)')]);
  assert.equal(findings.length, 2); assert.ok(findings.every(item => item.file === 'src/lib/a.ts'));
});
test('Phase 5 canonical pack serialization excludes signatures and is stable', () => {
  const left = canonicalKnowledgePack(CORE_KNOWLEDGE_PACK);
  const right = canonicalKnowledgePack({ ...CORE_KNOWLEDGE_PACK, signature: { algorithm: 'ed25519', keyId: 'test', digest: `sha256:${'0'.repeat(64)}`, signature: 'x' } });
  assert.equal(left, right); assert.ok(!right.includes('signature'));
});
test('Phase 5 accuracy corpus contains 100+ diverse representative projects', () => {
  assert.ok(PHASE5_ACCURACY_FIXTURES.length >= 100);
  for (const kind of ['positive', 'negative', 'mixed-stack', 'monorepo', 'vendor-heavy', 'vulnerable', 'browser', 'cross-platform']) assert.ok(PHASE5_ACCURACY_FIXTURES.some(item => item.kind === kind));
});
for (const fixture of PHASE5_ACCURACY_FIXTURES) {
  test('accuracy fixture: ' + fixture.id, () => {
    const parsed = parseFiles(fixture.files); const classification = classifyProject(fixture.files, parsed);
    assert.equal(classification.isSoftware, fixture.expected.software);
    const detections = detectRegisteredTechnologies(fixture.files);
    assert.ok(detections.length >= (fixture.expected.minimumDetections ?? 0));
    if (fixture.expected.securityFinding) assert.ok(detectSecurityIntelligence(fixture.files).findings.length > 0);
    if (fixture.expected.browserFinding) assert.ok(detectBrowserCompatibility(fixture.files).findings.length > 0);
  });
}
for (const definition of PLATFORM_KNOWLEDGE.filter(item => item.dependencies?.length || item.files?.length || item.filePrefixes?.length)) {
  test('platform marker fixture: ' + definition.id, () => {
    const fixture = definition.dependencies?.length
      ? pkg('package.json', { [definition.dependencies[0]]: '1' })
      : definition.files?.length
        ? file(definition.files[0], 'marker')
        : file(definition.filePrefixes[0] + 'ts', 'marker');
    assert.ok(detectRegisteredTechnologies([fixture]).some(item => item.id === definition.id));
  });
}
test('platform path pattern recognizes GitHub Actions', () => {
  assert.ok(detectRegisteredTechnologies([file('.github/workflows/ci.yml', 'jobs: {}')]).some(item => item.id === 'ci2-github-actions'));
});
test('Phase 2 registry coverage gates', () => {
  const counts = Object.fromEntries(['package-manager', 'build-tool', 'runtime', 'database', 'testing', 'cloud', 'ci-cd'].map(kind => [kind, PLATFORM_KNOWLEDGE.filter(item => item.kind === kind).length]));
  assert.deepEqual(counts, { 'package-manager': 40, 'build-tool': 60, runtime: 25, database: 50, testing: 60, cloud: 40, 'ci-cd': 25 });
  assert.equal(PROJECT_CAPABILITY_COUNT, 25);
  assert.ok(TECHNOLOGY_REGISTRY.length >= 600);
});
test('technology graph exposes soft capabilities and evidence relationships', () => {
  const detections = detectRegisteredTechnologies([
    pkg('package.json', { react: '18', vite: '5', jest: '29', pg: '8' }),
    file('vercel.json', '{}'),
  ]);
  const graph = buildTechnologyGraph(detections);
  assert.ok(graph.capabilities.some(item => item.id === 'web-frontend'));
  assert.ok(graph.capabilities.some(item => item.id === 'testing'));
  assert.ok(graph.capabilities.some(item => item.id === 'database'));
  assert.ok(graph.relationships.some(item => item.type === 'builds-with'));
  assert.ok(graph.relationships.some(item => item.type === 'deploys-to'));
  assert.ok(graph.relationships.every(item => item.evidence));
});
test('shared database drivers do not imply compatible database brands', () => {
  const ids = detectRegisteredTechnologies([pkg('package.json', { pg: '8', mysql2: '3', 'cassandra-driver': '4' })]).map(item => item.id);
  for (const id of ['db2-cockroachdb', 'db2-timescaledb', 'db2-scylladb', 'db2-tidb', 'db2-yugabytedb']) assert.ok(!ids.includes(id));
});
test('generic cloud filenames require vendor evidence', () => {
  const generic = detectRegisteredTechnologies([
    file('app.yaml', 'name: app'), file('service.yaml', 'kind: Service'),
    file('manifest.yml', 'name: app'), file('template.yaml', 'kind: Template'),
    file('.gitlab-ci.yml', 'build:\n  script: echo ok'),
  ]).map(item => item.id);
  for (const id of ['cloud2-google-app-engine', 'cloud2-google-cloud-run', 'cloud2-gitlab-pages', 'cloud2-cloud-foundry', 'cloud2-openshift']) assert.ok(!generic.includes(id));
  const exact = detectRegisteredTechnologies([
    file('app.yaml', 'runtime: nodejs20'), file('service.yaml', 'apiVersion: serving.knative.dev/v1'),
    file('manifest.yml', 'applications:\n- name: app'), file('template.yaml', 'apiVersion: template.openshift.io/v1'),
    file('.gitlab-ci.yml', 'pages:\n  script: publish'),
  ]).map(item => item.id);
  for (const id of ['cloud2-google-app-engine', 'cloud2-google-cloud-run', 'cloud2-gitlab-pages', 'cloud2-cloud-foundry', 'cloud2-openshift']) assert.ok(exact.includes(id));
});
test('Next.js does not imply Turbopack without its command flag', () => {
  assert.ok(!detectRegisteredTechnologies([pkg('package.json', { next: '16' })]).some(item => item.id === 'build2-turbopack'));
  assert.ok(detectRegisteredTechnologies([file('package.json', '{"dependencies":{"next":"16"},"scripts":{"dev":"next dev --turbopack"}}')]).some(item => item.id === 'build2-turbopack'));
});
await asyncTest('Phase 5 verifies trusted Ed25519 packs and rejects tampering', async () => {
  const keys = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const unsigned = JSON.parse(exportKnowledgePack(CORE_KNOWLEDGE_PACK));
  const payload = new TextEncoder().encode(canonicalKnowledgePack(unsigned));
  const digest = Buffer.from(await crypto.subtle.digest('SHA-256', payload)).toString('hex');
  const signature = Buffer.from(await crypto.subtle.sign({ name: 'Ed25519' }, keys.privateKey, payload)).toString('base64');
  const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', keys.publicKey)).toString('base64');
  const signed = { ...unsigned, signature: { algorithm: 'ed25519', keyId: 'ryzova-test', digest: `sha256:${digest}`, signature } };
  const verified = await verifyKnowledgePack(signed, [{ keyId: 'ryzova-test', publisher: signed.publisher, publicKey }]);
  assert.equal(verified.trusted, true); assert.equal(verified.valid, true);
  const tampered = await verifyKnowledgePack({ ...signed, description: 'tampered' }, [{ keyId: 'ryzova-test', publisher: signed.publisher, publicKey }]);
  assert.equal(tampered.trusted, false); assert.equal(tampered.valid, false);
});
await asyncTest('V3 pack signing verifies trusted publishers and rejects tampering', async () => {
  const keys = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const signed = await signV3RulePack(V3_CORE_RULE_PACK, 'ryzova-v3-test', keys.privateKey);
  const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', keys.publicKey)).toString('base64');
  const trust = [{ keyId: 'ryzova-v3-test', publisher: signed.publisher, publicKey }];
  const verified = await verifyV3RulePack(signed, trust); assert.equal(verified.valid, true); assert.equal(verified.trusted, true);
  const tampered = await verifyV3RulePack({ ...signed, description: 'tampered' }, trust); assert.equal(tampered.valid, false); assert.equal(tampered.trusted, false);
});
await asyncTest('large ZIP extraction samples at the analysis budget and reports reading progress', async () => {
  const JSZip = nativeRequire('jszip');
  const zip = new JSZip();
  zip.file('linux-main/Makefile', 'VERSION = 6\n');
  for (let index = 0; index < 25_100; index++) zip.file(`linux-main/src/part-${String(index).padStart(5, '0')}.c`, 'int main(void) { return 0; }');
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'STORE' });
  const updates = [];
  // JSZip consumes Uint8Array directly in Node; browsers pass the File object.
  const archive = Object.assign(bytes, { name: 'linux.zip', size: bytes.byteLength });
  const result = await readZip(archive, (read, total) => updates.push([read, total]));
  assert.equal(result.scanStats.filesFound, 25_101);
  assert.equal(result.scanStats.filesAnalyzed, 25_000);
  assert.equal(result.scanStats.sampled, true);
  assert.equal(result.scanStats.truncated, true);
  assert.equal(result.scanStats.filesIgnored, 101);
  assert.ok(result.files.some(item => item.path === 'Makefile'));
  assert.deepEqual(updates.at(-1), [25_000, 25_000]);
});
console.log(JSON.stringify({ checks, phase5FixtureAssertions, phase5FixtureRules: V3_PHASE5_RULE_COUNT, v3StableFixtureTarget: 30_000, technologies: TECHNOLOGY_REGISTRY.length, additionalLanguages: new Set(Object.values(ADDITIONAL_LANGUAGE_EXTENSIONS)).size }));
