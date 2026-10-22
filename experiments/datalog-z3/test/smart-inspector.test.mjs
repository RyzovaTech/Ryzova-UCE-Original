import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectSmartEvidence } from '../evidence-inspector.mjs';

const fixture=JSON.parse(await readFile(new URL('../fixtures/conflict.json',import.meta.url),'utf8'));
const mutate=(fn)=>{
  const files=fixture.files.map(f=>({...f}));
  const pkg=JSON.parse(files[0].content);
  const lock=JSON.parse(files[1].content);
  fn(pkg,lock);
  files[0].content=JSON.stringify(pkg);
  files[1].content=JSON.stringify(lock);
  return files;
};

test('inspector recognizes fully supported joint evidence without native startup',()=>{
  const a=inspectSmartEvidence(fixture.files);
  assert.equal(a.eligible,true);
  assert.ok(a.rules.includes('D2') && a.rules.includes('D4'));
  assert.equal(a.needsSouffle,true);
  assert.match(a.digest,/^[0-9a-f]{64}$/);
  assert.equal(a.digest,inspectSmartEvidence(fixture.files).digest);
});

test('two requirements are eligible even without a third',()=>{
  const p=inspectSmartEvidence(mutate((pkg,lock)=>{
    delete lock.packages['node_modules/beta'];
    lock.packages['node_modules/alpha'].dependencies={};
  }));
  assert.equal(p.eligible,true);
  assert.ok(p.rules.includes('D2'));
});

test('root single internal contradiction is eligible but ordinary single range is skipped',()=>{
  const files=mutate((pkg,lock)=>{
    pkg.engines.node='>=22 <21';
    delete lock.packages['node_modules/alpha'].engines;
    delete lock.packages['node_modules/beta'].engines;
  });
  const contradictory=inspectSmartEvidence(files);
  assert.equal(contradictory.eligible,true);
  assert.equal(contradictory.needsSouffle,false);
  assert.ok(contradictory.rules.includes('D3'));
  const ordinary=inspectSmartEvidence(mutate((pkg,lock)=>{
    delete lock.packages['node_modules/alpha'].engines;
    delete lock.packages['node_modules/beta'].engines;
  }));
  assert.equal(ordinary.eligible,false);
  assert.equal(ordinary.status,'skipped');
});

test('unknown on malformed lock graph, alias or prerelease instead of false SAT',()=>{
  const bad=inspectSmartEvidence(mutate((pkg,lock)=>{delete lock.packages['node_modules/alpha'];}));
  assert.equal(bad.status,'unknown');
  assert.equal(bad.eligible,false);
  const pre=inspectSmartEvidence(mutate((pkg,lock)=>{lock.packages['node_modules/alpha'].engines.node='>=22.0.0-beta.1';}));
  assert.equal(pre.status,'unknown');
  assert.equal(pre.eligible,false);
});

test('exact workspace scope is preserved across independent projects',()=>{
  const files=[
    ...fixture.files.map(x=>({...x,path:'apps/api/'+x.path})),
    ...fixture.files.map(x=>({...x,path:'apps/web/'+x.path})),
  ];
  const a=inspectSmartEvidence(files.filter(x=>x.path.startsWith('apps/api/')),'apps/api');
  const b=inspectSmartEvidence(files.filter(x=>x.path.startsWith('apps/web/')),'apps/web');
  assert.equal(a.eligible,true);
  assert.equal(b.eligible,true);
  assert.notEqual(a.digest,b.digest);
  assert.equal(inspectSmartEvidence(files.filter(x=>x.path.startsWith('apps/api/')),'apps/web').status,'unknown');
});
