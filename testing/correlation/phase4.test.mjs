import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../../scripts/trusted-module-loader.mjs';
const { versionRangesDisjoint: disjoint } = load('src/lib/analyzer/version-constraints.ts');
const { versionCorrelationRules } = load('src/lib/compatibility/rules/version-correlation.ts');
const { npmLockCorroborates } = load('src/lib/analyzer/declaration-evidence.ts');
const { executeV3RulePacks } = load('src/lib/knowledge/v3-sdk.ts');
const { V3_PHASE4_RULE_PACKS } = load('src/lib/knowledge/v3-phase4-packs.ts');
const file = (path, content) => ({ path, content, size: Buffer.byteLength(content), isDirectory: false });
const json = (path, value) => file(path, JSON.stringify(value));
const node = (files) => versionCorrelationRules[0].run({ files, detectedFiles: [], stack: {}, projectName: 'contracts' });
const lockRule = V3_PHASE4_RULE_PACKS.flatMap(pack => pack.rules).find(rule => rule.detectors[0].mode === 'lockfile-version' && rule.detectors[0].packageName === 'react');
const moduleRule = V3_PHASE4_RULE_PACKS.flatMap(pack => pack.rules).find(rule => rule.detectors[0].semantic === 'node-module-typescript');
const execute = (rule, files) => executeV3RulePacks([{ schemaVersion: 3, id: 'org.ryzova.phase4.tests', name: 'Contracts', version: '3.0.0', publisher: 'RyzovaTech', description: 'Synthetic contracts', uceCompatibility: '>=2.0.0 <4.0.0', technologies: rule.technologies, modules: [rule.module], rules: [rule] }], { files, technologies: rule.technologies }).findings;
test('stable ranges respect caret zero majors, tilde, comparators, wildcards and alternatives', () => {
  for (const [range, version, expected] of [
    ['^18.2.0','19.0.0',true],['^18.2.0','18.3.0',false],['^0.2.3','0.3.0',true],['^0.0.3','0.0.4',true],
    ['^0.0','0.0.9',false],['~1.2.3','1.3.0',true],['~1','1.9.9',false],['1.2.x','1.3.0',true],
    ['>=20 <23','22.9.1',false],['>=20 <23','23.0.0',true],['>20','20.9.9',true],['<=20','20.9.9',false],
    ['>=20.5.0','20',false],['18 || >=22','20',true],['18 || >=22','22',false],['*','25.0.0',false],
    ['=1.2.3','1.2.4',true],['<1.2.3','1.2.3',true],['<=1.2.3','1.2.3',false],['>= 20','20.0.0',false],
  ]) assert.equal(disjoint(range, version), expected, `${range}: ${version}`);
});
test('unsupported and malformed version syntax remains unknown', () => {
  for (const value of ['latest','lts/*','workspace:^','npm:other@1.2.3','1.2.3-beta.1','1.2.3+meta','1 - 2','', '01.2.3','1.x.3','>=22 <20','>=20 || garbage'])
    assert.equal(disjoint(value, '20.0.0'), undefined, value);
  assert.equal(disjoint('>=20', '20.0.0-rc.1'), undefined);
});
test('runtime pins require same-package declarations and preserve paired file evidence', () => {
  const files = [json('apps/api/package.json',{engines:{node:'>=22'}}), file('apps/api/.nvmrc','20\n'), file('apps/api/Dockerfile','FROM node:20-alpine AS build\nFROM node:22-alpine')];
  const issues = node(files); assert.equal(issues.length,2); assert.match(issues[0].description,/apps\/api\/package.json/);
  assert.equal(node([json('apps/a/package.json',{engines:{node:'>=22'}}),json('apps/b/package.json',{}),file('apps/b/.nvmrc','20')]).length,0);
  assert.equal(node([json('package.json',{engines:{node:'>=22'}}),file('apps/b/package.json','{bad'),file('apps/b/Dockerfile','FROM node:20')]).length,0);
});
test('runtime compatibility ignores prose, dynamic/private images and partial overlap', () => {
  const pkg = json('package.json',{engines:{node:'>=20.5'}});
  for (const content of ['# FROM node:18','RUN echo FROM node:18','FROM registry.example/node:18','FROM node:${VERSION}','FROM node:20','FROM node:22'])
    assert.equal(node([pkg,file('Dockerfile',content)]).length,0,content);
  for (const content of ['lts/*','20\n22','latest','# 18\n20']) assert.equal(node([pkg,file('.nvmrc',content)]).length,0,content);
  assert.equal(node([pkg,file('Dockerfile','FROM --platform=linux/amd64 docker.io/library/node:18-alpine')]).length,1);
  for (const prefix of ['tests/','vendor/','dist/','examples/']) assert.equal(node([json(prefix+'package.json',{engines:{node:'>=22'}}),file(prefix+'.nvmrc','18')]).length,0);
});
test('range-aware lock conflicts require a valid installed entry in the matching package', () => {
  const pkg = json('package.json',{dependencies:{react:'^18.2.0'}});
  assert.equal(execute(lockRule,[pkg,json('package-lock.json',{packages:{'node_modules/react':{version:'19.0.0'}}})]).length,1);
  assert.equal(execute(lockRule,[pkg,json('package-lock.json',{packages:{'node_modules/react':{version:'18.3.0'}}})]).length,0);
  for (const entry of [{version:false},{version:'garbage'},{version:'19.0.0-beta.1'},['19.0.0']]) assert.equal(execute(lockRule,[pkg,json('package-lock.json',{packages:{'node_modules/react':entry}})]).length,0);
  assert.equal(execute(lockRule,[pkg,json('apps/other/package-lock.json',{packages:{'node_modules/react':{version:'19.0.0'}}})]).length,0);
});
test('lock corroboration does not inflate confidence from an incompatible installed version', () => {
  const declaration={name:'react',file:'package.json',identity:false,version:'^18.2.0'};
  const locked=version=>json('package-lock.json',{packages:{'':{dependencies:{react:'^18.2.0'}},'node_modules/react':{version}}});
  assert.equal(npmLockCorroborates([locked('19.0.0')],declaration),undefined);
  assert.equal(npmLockCorroborates([locked('18.3.0')],declaration),'package-lock.json');
});
test('module correlation reads compilerOptions and excludes no-emit, extends and prose', () => {
  const pkg=json('package.json',{type:'module'});
  for (const config of [{compilerOptions:{module:'CommonJS'}},{compilerOptions:{module:'commonjs'}}]) assert.equal(execute(moduleRule,[pkg,json('tsconfig.json',config)]).length,1);
  for (const config of [{module:'CommonJS'},{notes:{module:'CommonJS'}},{compilerOptions:{module:'CommonJS',noEmit:true}},{compilerOptions:{module:'CommonJS',noEmit:'false'}},{compilerOptions:{module:'CommonJS',emitDeclarationOnly:true}},{extends:'./base.json',compilerOptions:{module:'CommonJS'}},[]])
    assert.equal(execute(moduleRule,[pkg,json('tsconfig.json',config)]).length,0);
  assert.equal(execute(moduleRule,[json('package.json',{description:'type module',notes:{type:'module'}}),json('tsconfig.json',{compilerOptions:{module:'CommonJS'}})]).length,0);
  assert.equal(execute(moduleRule,[pkg,file('tsconfig.json','{ // "module":"CommonJS"\n "compilerOptions":{"module":"ESNext"}}')]).length,0);
  assert.equal(execute(moduleRule,[pkg,file('tsconfig.json','{/*comment*/"compilerOptions":{"module":"CommonJS",},}')]).length,1);
});
test('module pairing never crosses nested or sibling package boundaries', () => {
  assert.equal(execute(moduleRule,[json('apps/a/package.json',{type:'module'}),json('apps/b/package.json',{}),json('apps/b/tsconfig.json',{compilerOptions:{module:'CommonJS'}})]).length,0);
  assert.equal(execute(moduleRule,[json('package.json',{type:'module'}),file('apps/b/package.json','{bad'),json('apps/b/tsconfig.json',{compilerOptions:{module:'CommonJS'}})]).length,0);
});
