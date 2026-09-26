import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
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

const { detectStack } = load('src/lib/analyzer/detectors.ts');
const { parseFiles } = load('src/lib/analyzer/parser.ts');
const { detectDependencyIntelligence } = load('src/lib/analyzer/intelligence.ts');
const { detectSecurityIntelligence } = load('src/lib/analyzer/security-intelligence.ts');
const { detectRegisteredTechnologies } = load('src/lib/analyzer/technology-registry.ts');
const f = (path, content) => ({path, content, size: Buffer.byteLength(content), isDirectory:false});
const results = [];
const check = (id, area, expected, actual) => results.push({id, area, expected, actual, passed: expected === actual});
// Hand-labeled bounded scenarios; not full repositories or a random sample.
for (const [name, manifest, content, manager] of [
 ['rust','Cargo.toml','[package]\nname="tool"','cargo'],
 ['go','go.mod','module example.org/app','go-modules'],
 ['php','composer.json','{"require":{}}','composer'],
 ['java','pom.xml','<project/>','maven'],
]) {
 const files=[f(manifest,content),f('tools/pyproject.toml','[project]\nname="helper"')];
 check(name+'-manager','identity',true,detectStack(files,parseFiles(files)).packageManager===manager);
}
for (const [id,name,manifest,content] of [
 ['react','React','package.json','{"dependencies":{"react":"18"}}'],
 ['vue','Vue','package.json','{"dependencies":{"vue":"3"}}'],
 ['django','Django','requirements.txt','django>=5'],
 ['tokio','Tokio','Cargo.toml','[dependencies]\ntokio="1"'],
]) {
 for (const [scope,prefix,expected] of [['production','',true],['vendor','vendor/',false],['fixture','fixtures/',false]]) {
  const detections=detectRegisteredTechnologies([f(prefix+manifest,content)]);
  check(id+'-'+scope,'technology',expected,detections.some(x=>x.name.toLowerCase()===name.toLowerCase()));
 }
}
for (const [id,path,source,expected] of [
 ['pickle-call','app.py','pickle.loads(data)',true],
 ['pickle-comment','app.py','# pickle.loads(data)',false],
 ['pickle-string','app.py','note = "pickle.loads(data)"',false],
 ['pickle-test','tests/test_app.py','pickle.loads(data)',false],
 ['pickle-fixture','fixtures/app.py','pickle.loads(data)',false],
 ['pickle-reviewed','app.py','if verified(data):\n    pickle.loads(data)',true],
]) check(id,'security-pattern',expected,detectSecurityIntelligence([f(path,source)]).findings.some(x=>x.ruleId==='SEC015'));
for (const [id,files,name,expected] of [
 ['npm-declared',[f('package.json','{"dependencies":{"react":"18"}}')],'react',true],
 ['npm-array-invalid',[f('package.json','{"dependencies":["react"]}')],'0',false],
 ['npm-json-schema',[f('package.json','{"$schema":"https://json-schema.org/draft-07/schema#","type":"object","dependencies":{"foo":["bar"]}}')],'foo',false],
 ['empty-manifest-count',[f('package.json','{"dependencies":{}}')],null,true],
 ['cargo-declared',[f('Cargo.toml','[dependencies]\nserde="1"')],'serde',true],
 ['go-declared',[f('go.mod','module sample\nrequire github.com/gin-gonic/gin v1.10.0')],'github.com/gin-gonic/gin',true],
 ['python-declared',[f('pyproject.toml','[project]\ndependencies=["flask>=3"]')],'flask',true],
 ['vendor-ignored',[f('vendor/package.json','{"dependencies":{"react":"18"}}')],'react',false],
]) {
 const deps=detectDependencyIntelligence(files,detectStack(files,parseFiles(files)));
 check(id,'dependency-inventory',expected,name===null ? deps.manifestsScanned===1 : deps.dependencies.some(x=>x.name===name));
}
const confusion = rows => {
 let tp=0,tn=0,fp=0,fn=0;
 for (const r of rows) { if(r.expected) { if(r.actual)tp++;else fn++; } else {if(r.actual)fp++;else tn++;} }
 const pct=(a,b)=>b ? Math.round(10000*a/b)/100 : null;
 return {cases:rows.length,tp,tn,fp,fn,accuracy:pct(tp+tn,rows.length),precision:pct(tp,tp+fp),recall:pct(tp,tp+fn)};
};
const report={benchmark:'UCE bounded accuracy audit',schemaVersion:1,scope:'30 hand-labeled synthetic decisions; development-set regression measurement, not independent real-world accuracy',overall:confusion(results),areas:Object.fromEntries([...new Set(results.map(x=>x.area))].map(area=>[area,confusion(results.filter(x=>x.area===area))])),failures:results.filter(x=>!x.passed),results};
console.log(JSON.stringify(report,null,2));

if (process.argv.includes('--check') && report.failures.length) process.exitCode = 1;
