import test from 'node:test';
import assert from 'node:assert/strict';
import {extractLockedDependencyGraph} from '../../experiments/datalog-z3/graph.mjs';
import {buildCvc5SmtLib} from '../../experiments/datalog-z3/cvc5.mjs';
import {dependencyPath} from '../../experiments/datalog-z3/datalog.mjs';

const file=(path,content)=>({path,content,isDirectory:false,size:Buffer.byteLength(content)});
const inputs=()=>[
 file('package.json',JSON.stringify({
  name:'contract',engines:{node:'>=18'},dependencies:{alpha:'^1.0.0'},
 })),
 file('package-lock.json',JSON.stringify({lockfileVersion:3,packages:{
  '':{name:'contract',version:'1.0.0',dependencies:{alpha:'^1.0.0'}},
  'node_modules/alpha':{version:'1.1.0',engines:{node:'>=22'},dependencies:{beta:'^2.0.0'}},
  'node_modules/beta':{version:'2.1.0',engines:{node:'<21'}},
 }})),
];
test('ported locked graph derives root-to-transitive source facts and bounded requirements',()=>{
 const g=extractLockedDependencyGraph(inputs(),'');
 assert.equal(g.status,'ok',g.reason);
 assert.deepEqual(g.edges,[['__uce_root__','node_modules/alpha'],
  ['node_modules/alpha','node_modules/beta']]);
 assert.deepEqual(g.constraints.map(f=>f.range),['>=18','>=22','<21']);
 assert.deepEqual(dependencyPath(g,'node_modules/beta'),
  ['__uce_root__','node_modules/alpha','node_modules/beta']);
});
test('shared SMT-LIB encoding uses normalized numeric Node ranges only',()=>{
 const g=extractLockedDependencyGraph(inputs(),'');
 const smt=buildCvc5SmtLib(g.constraints);
 assert.ok(typeof smt==='string');
 assert.match(smt,/\(set-logic QF_LIA\)/);
 assert.match(smt,/\(check-sat\)/);
 assert.match(smt,/\(declare-const major Int\)/);
 assert.ok(!smt.includes('node_modules/alpha'));
 assert.ok(!smt.includes('package-lock.json'));
});
test('npm graph cannot become healthy with stale or missing locked transitive evidence',()=>{
 const f=inputs();
 const lock=JSON.parse(f[1].content);delete lock.packages['node_modules/beta'];
 f[1]=file('package-lock.json',JSON.stringify(lock));
 assert.equal(extractLockedDependencyGraph(f).status,'unknown');
});
test('optional peer, dynamic platform and unsupported lock semantics abort native proof',()=>{
 for(const key of ['peerDependencies','optionalDependencies','workspaces']){
  const f=inputs(),pkg=JSON.parse(f[0].content);
  pkg[key]=key==='workspaces'?['packages/*']:{beta:'^2.0.0'};
  f[0]=file('package.json',JSON.stringify(pkg));
  assert.equal(extractLockedDependencyGraph(f).status,'unknown',key);
 }
});
test('unsupported raw semver text or source injection cannot enter SMT-LIB',()=>{
 for(const range of ['>=18) (check-sat)','node --version','latest','1.0.0-beta.1']){
  assert.equal(buildCvc5SmtLib([{id:'bad',range,source:'package.json#engines.node'}]),null,range);
 }
});
test('source file list ordering does not change complete scoped graph semantics',()=>{
 const a=extractLockedDependencyGraph(inputs());
 const b=extractLockedDependencyGraph(inputs().reverse());
 assert.deepEqual(a,b);
});
