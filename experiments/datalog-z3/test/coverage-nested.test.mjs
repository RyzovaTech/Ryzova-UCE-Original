import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extractLockedDependencyGraph } from '../graph.mjs';
import { inspectSmartEvidence } from '../evidence-inspector.mjs';
import { dependencyPath } from '../datalog.mjs';
import { evaluateSmartSequential } from '../smart-sequential.mjs';

function file(path,content){return{path,content,isDirectory:false,size:Buffer.byteLength(content)};}
function small(update=()=>{}) {
  const pkg={name:'small',version:'1.0.0',engines:{node:'>=20'},dependencies:{alpha:'^1.0.0'}};
  const lock={lockfileVersion:3,packages:{
    '':{name:'small',version:'1.0.0',dependencies:{alpha:'^1.0.0'}},
    'node_modules/alpha':{version:'1.2.0',dependencies:{beta:'^2.0.0'},engines:{node:'>=22'}},
    'node_modules/beta':{version:'2.1.0',engines:{node:'<19'}},
    'node_modules/alpha/node_modules/beta':{version:'2.4.0',engines:{node:'<21'}},
  }};
  update(pkg,lock);
  return [file('package.json',JSON.stringify(pkg)),file('package-lock.json',JSON.stringify(lock))];
}
test('exact nested dependency shadows hoisted name with source-backed dependency path',()=>{
  const graph=extractLockedDependencyGraph(small());
  assert.equal(graph.status,'ok',graph.reason);
  assert.deepEqual(dependencyPath(graph,'node_modules/alpha/node_modules/beta'),
    ['__uce_root__','node_modules/alpha','node_modules/alpha/node_modules/beta']);
  assert.ok(!graph.packages.includes('node_modules/beta'),'unreachable hoisted beta must not become a constraint');
  const ranges=graph.constraints.map(c=>c.range);
  assert.ok(ranges.includes('<21') && !ranges.includes('<19'));
});
test('nested version mismatch must not silently fall back to hoisted copy',()=>{
  const result=extractLockedDependencyGraph(small((pkg,lock)=>{
    lock.packages['node_modules/alpha/node_modules/beta'].version='3.1.0';
  }));
  assert.equal(result.status,'unknown');
  assert.match(result.reason,/version does not satisfy/);
});
test('closest scoped nested installation is resolved without conflating similarly named packages',()=>{
  const data=small((pkg,lock)=>{
    lock.packages['node_modules/alpha'].dependencies={'@scope/beta':'^2.0.0'};
    lock.packages['node_modules/alpha/node_modules/@scope/beta']=
      lock.packages['node_modules/alpha/node_modules/beta'];
    delete lock.packages['node_modules/alpha/node_modules/beta'];
  });
  const graph=extractLockedDependencyGraph(data);
  assert.equal(graph.status,'ok',graph.reason);
  assert.ok(graph.packages.includes('node_modules/alpha/node_modules/@scope/beta'));
});
test('missing nested and hoisted resolutions explicitly abstain',()=>{
  const r=extractLockedDependencyGraph(small((pkg,lock)=>{
    delete lock.packages['node_modules/beta'];
    delete lock.packages['node_modules/alpha/node_modules/beta'];
  }));
  assert.equal(r.status,'unknown');
  assert.match(r.reason,/Missing locked dependency/);
});
test('reachable peer/link/platform/optional/alias semantics remain unsupported',()=>{
  const checks=[
    (pkg,lock)=>{lock.packages['node_modules/alpha'].peerDependencies={react:'^18.0.0'};},
    (pkg,lock)=>{lock.packages['node_modules/alpha'].link=true;},
    (pkg,lock)=>{lock.packages['node_modules/alpha'].os=['linux'];},
    (pkg,lock)=>{lock.packages['node_modules/alpha'].optional=true;},
    (pkg)=>{pkg.dependencies.alpha='npm:fake@1.0.0';},
    (pkg)=>{pkg.workspaces=['packages/*'];},
  ];
  for(const edit of checks){
    const graph=extractLockedDependencyGraph(small(edit));
    assert.equal(graph.status,'unknown',JSON.stringify(graph));
  }
});
test('optional peer hint without a real peer requirement does not invent a dependency',()=>{
  const input=small((pkg,lock)=>{
    lock.packages['node_modules/alpha'].peerDependenciesMeta={
      debug:{optional:true},
    };
  });
  const graph=extractLockedDependencyGraph(input);
  assert.equal(graph.status,'ok',graph.reason);
  assert.equal(graph.packages.length,3);
});
test('unreachable dev-only package metadata does not contaminate mandatory source graph',()=>{
  const graph=extractLockedDependencyGraph(small((pkg,lock)=>{
    for(let i=0;i<120;i++)
      lock.packages['node_modules/dev-only-'+i]={version:'1.0.0',
        peerDependencies:{react:'*'},engines:{node:'<1'}};
  }));
  assert.equal(graph.status,'ok',graph.reason);
  assert.ok(!graph.constraints.some(x=>x.range==='<1'));
});
const axiosBase=new URL('../../../testing/trilogy/real-fixtures/axios/',import.meta.url);
const axiosPkg=await readFile(new URL('package.json',axiosBase));
const axiosLock=await readFile(new URL('package-lock.json',axiosBase));
const gitBlob=bytes=>createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
const axiosFiles=[
  file('package.json',axiosPkg.toString('utf8')),
  file('package-lock.json',axiosLock.toString('utf8')),
];
test('independently freeze exact public axios Git source blobs, not authored test locks',()=>{
  assert.equal(gitBlob(axiosPkg),'b4e3d1e48866809f4098494516806afdf1a8bcb5');
  assert.equal(gitBlob(axiosLock),'0fc1d3dcf01f09e50bf34a538e16de1743151516');
  assert.ok(axiosLock.byteLength>256*1024);
});
test('real pinned axios lock reaches nested mandatory packages despite dev-only lock expansion',()=>{
  const g=extractLockedDependencyGraph(axiosFiles);
  assert.equal(g.status,'ok',g.reason);
  assert.equal(g.packages.length,27,'26 reachable mandatory dependencies plus root');
  assert.equal(g.constraints.length,23,'all source-backed mandatory Node engine requirements');
  assert.ok(g.packages.includes('node_modules/form-data/node_modules/mime-types'));
  const inspection=inspectSmartEvidence(axiosFiles);
  assert.equal(inspection.eligible,true,inspection.reason);
  assert.match(inspection.digest,/^[a-f0-9]{64}$/);
});
test('real pinned axios mandatory constraints are serially cross-verified by all native stages',{
  timeout:30000,
},async()=>{
  const r=await evaluateSmartSequential(axiosFiles,{wallMs:15000,nativeZ3Binary:'z3'});
  assert.equal(r.status,'satisfiable',JSON.stringify(r));
  assert.equal(r.verification,'independent-smt-agreement');
  assert.deepEqual(r.stageTrace.map(x=>x.stage),['souffle','z3','cvc5']);
  assert.ok(r.stageTrace.every((s,i,items)=>i===0 || items[i-1].closedMs<=s.startedMs));
  assert.ok(r.witness);
});
