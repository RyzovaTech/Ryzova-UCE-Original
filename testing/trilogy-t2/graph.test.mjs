import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWholeProjectGraph as build } from './graph.mjs';
const file=(path,content)=>({path,content,size:Buffer.byteLength(content??''),isDirectory:false});
const report=(partial=false)=>({
 id:'id',createdAt:'today',analysisVersion:'3.0.0-beta.1',
 classification:{isSoftware:true},score:{overall:87,applicableCategories:['runtime']},
 categories:[{id:'runtime',label:'Runtime',status:'warning',score:87,issues:[]}],
 issues:[],stack:{},
 summary:{name:'test',scanStats:{filesFound:4,filesAnalyzed:4,filesIgnored:0,
 projectSize:100,ignoredCategories:[],truncated:partial},
 analysisCoverage:{status:partial?'partial':'full',filesAnalyzed:4,filesFound:4,fileCoveragePercent:100}}
});
const fixtures=()=>[file('package.json','{"name":"app","engines":{"node":">=22"}}'),
 file('.nvmrc','20\n'),
 file('src/a.ts',"import {x} from './b';\nexport {x} from './b';"),
 file('src/b.ts','export const x=1;')];
test('read-only canonical parity and source-backed cross-file edges',()=>{
 const f=fixtures(),r=report(),before=JSON.stringify([r,f]);
 const o=build(r,f,{inventoryComplete:true});
 assert.equal(JSON.stringify([r,f]),before);
 assert.equal(o.counts.relationships,2);
 assert.equal(o.counts.sourceSupported,2);
 assert.equal(o.originalCoreScore,87);
 assert.equal(o.verifiedCompatibilityCount,0);
 assert.equal(o.independentlyAdjudicatedAccuracy,null);
 assert.equal(o.automaticPatchesAllowed,false);
 assert.ok(!JSON.stringify(o).includes('src/a.ts'));
});
test('AST ignores comments, string constants and template text',()=>{
 const template=String.fromCharCode(96);
 const contents="// import './ghost';\nconst x = \"import './fake'\";\n"+
  'const t = '+template+"import './template'"+template+";\n/* require('./skip') */";
 const o=build(report(),[file('src/a.ts',contents)],{inventoryComplete:true});
 assert.equal(o.counts.relationships,0);
});
test('import, re-export, require and dynamic import are distinct static observations',()=>{
 const f=[file('src/a.ts',"import {x} from './b';\nexport {x} from './b';\nrequire('./b');\nimport('./b');"),
  file('src/b.ts','export const x=1;')];
 const o=build(report(),f);
 assert.equal(o.counts.relationships,4);
 assert.ok(o.edges.every(x=>x.status==='source-supported'&&!x.safeAutoFix));
});
test('missing relative link is unknown without caller-complete inventory, only review otherwise',()=>{
 const f=[file('src/a.ts',"import './missing';")];
 assert.equal(build(report(),f).counts.unknown,1);
 const o=build(report(),f,{inventoryComplete:true});
 assert.equal(o.counts.reviewRequired,1);
 assert.equal(o.verifiedCompatibilityCount,0);
});
test('partial canonical reports cannot turn absence into review proof',()=>{
 const o=build(report(true),[file('src/a.ts',"import './missing';")],{inventoryComplete:true});
 assert.equal(o.counts.unknown,1);
 assert.equal(o.coverage.negativeAbsenceEligible,false);
 assert.equal(o.inputScope,'partial-UCE-report');
});
test('source ambiguity and unreadable input disable absence certainty',()=>{
 const f=[file('src/a.ts',"import './b';"),file('src/b.ts','x'),file('src/b.js','x')];
 assert.equal(build(report(),f,{inventoryComplete:true}).counts.unknown,1);
 const o=build(report(),[file('src/a.ts',"import './missing';"),
   {path:'src/other.ts',content:undefined}],{inventoryComplete:true});
 assert.equal(o.counts.unknown,1);
 assert.equal(o.coverage.negativeAbsenceEligible,false);
});
test('JS-to-TS candidate recognized without claiming runtime success',()=>{
 const o=build(report(),[file('src/a.ts',"import './b.js';"),
  file('src/b.ts','export const value=1;')]);
 assert.equal(o.counts.sourceSupported,1);
 assert.equal(o.verifiedCompatibilityCount,0);
});
test('workspace scoped package link derives from manifest and import, not install state',()=>{
 const f=[file('packages/core/package.json','{"name":"@org/core"}'),
 file('app/src/a.ts',"import '@org/core';\nimport 'external';")];
 const o=build(report(),f,{inventoryComplete:true});
 assert.equal(o.counts.relationships,1);
 assert.equal(o.edges[0].type,'workspace-package-reference');
 assert.equal(o.counts.unmodeledPackageImports,1);
});
test('duplicate package identities remain ambiguous rather than falsely linked',()=>{
 const f=[file('a/package.json','{"name":"@org/core"}'),
 file('b/package.json','{"name":"@org/core"}'),
 file('app/src/a.ts',"import '@org/core';")];
 assert.equal(build(report(),f).counts.relationships,0);
});
test('same-workspace exact node pin contradiction remains review, not certified failure',()=>{
 const o=build(report(),fixtures());
 assert.equal(o.counts.runtimeDecisions,1);
 assert.equal(o.counts.runtimeReviewRequired,1);
 assert.equal(o.decisions[0].verifiedCompatibility,false);
});
test('supported nonconflicting ranges vs unsupported range expressions',()=>{
 const f=fixtures(); f[1]=file('.nvmrc','22\n');
 assert.equal(build(report(),f).decisions[0].status,'source-supported');
 f[0]=file('package.json','{"engines":{"node":"^22 || >=24"}}');
 assert.equal(build(report(),f).decisions[0].status,'unknown');
});
test('sibling packages cannot leak runtime pins into other workspaces',()=>{
 const f=[file('apps/a/package.json','{"engines":{"node":">=22"}}'),
 file('apps/b/package.json','{"name":"b"}'),file('apps/b/.nvmrc','20\n')];
 assert.equal(build(report(),f).counts.runtimeDecisions,0);
});
test('parse errors and TS path aliases cannot be promoted to missing link proof',()=>{
 const o=build(report(),[file('src/a.ts',"import { from './missing';")],{inventoryComplete:true});
 assert.equal(o.counts.relationships,0);
 assert.equal(o.coverage.parseFailures,1);
 assert.equal(o.coverage.negativeAbsenceEligible,false);
 const alias=build(report(),[file('src/a.ts',"import x from '@/configured';")],{inventoryComplete:true});
 assert.equal(alias.counts.relationships,0);
});
test('input order and report random metadata do not affect deterministic graph',()=>{
 const f=fixtures(),a=report(),b=structuredClone(a);
 b.id='new';b.createdAt='2099';b.summary.scanStats.scanTimeMs=999;
 assert.deepEqual(build(a,f),build(b,[...f].reverse()));
});
test('invalid paths, duplicates, boolean validation and oversized inventories fail closed',()=>{
 const r=report();
 for(const path of ['../x','/etc/passwd','src//a.ts','C:/users/f','src/a.ts?x'])
  assert.throws(()=>build(r,[file(path,'x')]));
 assert.throws(()=>build(r,[file('a.ts','a'),file('a.ts','b')]));
 assert.throws(()=>build(r,fixtures(),{inventoryComplete:'true'}));
 assert.throws(()=>build(r,Array.from({length:5001},(_,i)=>file('src/f'+i+'.ts',''))));
});
test('per-file and total-byte budget prevent unsafe absence or silent overflow',()=>{
 const large=file('src/a.ts','x'.repeat(262145));
 const o=build(report(),[large],{inventoryComplete:true});
 assert.equal(o.coverage.filesReadable,0);
 assert.equal(o.coverage.negativeAbsenceEligible,false);
 assert.throws(()=>build(report(),Array.from({length:17},(_,i)=>
  file('src/f'+i+'.ts','x'.repeat(256*1024)))));
});
test('edge budget advertises incomplete traversal and prevents negative absence',()=>{
 const imports=Array.from({length:4003},()=> "import './b';").join('\n');
 const o=build(report(),[file('src/a.ts',imports),file('src/b.ts','x')],{inventoryComplete:true});
 assert.equal(o.counts.relationships,4000);
 assert.equal(o.coverage.truncatedByBudget,true);
 assert.equal(o.coverage.negativeAbsenceEligible,false);
});

test('parser failure elsewhere downgrades earlier unresolved import from review to Unknown',()=>{
 const o=build(report(),[file('src/a.ts',"import './missing';"),
  file('src/z.ts',"import { from './broken';")],{inventoryComplete:true});
 assert.equal(o.coverage.parseFailures,1);
 assert.equal(o.counts.reviewRequired,0);
 assert.equal(o.counts.unknown,1);
 assert.equal(o.coverage.negativeAbsenceEligible,false);
});
test('nonliteral imports make source completeness unknown and cannot confirm absence',()=>{
 const o=build(report(),[file('src/a.ts',
  "import './missing';\nconst part = './actual';\nimport(part);")],{inventoryComplete:true});
 assert.equal(o.counts.unmodeledDynamicImports,1);
 assert.equal(o.counts.reviewRequired,0);
 assert.equal(o.counts.unknown,1);
 assert.equal(o.coverage.negativeAbsenceEligible,false);
});
test('an unreadable imported target cannot count as source-supported',()=>{
 const o=build(report(),[
  file('src/a.ts',"import './target';"),
  {path:'src/target.ts',content:undefined},
 ],{inventoryComplete:true});
 assert.equal(o.counts.sourceSupported,0);
 assert.equal(o.counts.unknown,1);
});
test('unsupported minor-range exact pins remain Unknown rather than modeled overlap',()=>{
 const o=build(report(),[
  file('package.json','{"engines":{"node":"22.4.0"}}'),
  file('.nvmrc','22'),
 ]);
 assert.equal(o.decisions[0].status,'unknown');
});
