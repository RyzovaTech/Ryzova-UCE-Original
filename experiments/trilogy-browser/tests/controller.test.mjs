import test from 'node:test';
import assert from 'node:assert/strict';
import {profileTrilogyBrowserWorker,trilogyBrowserReleaseGate,tryTrilogyBrowserSolve} from '../controller.mjs';

class FakeWorker {
  constructor({respond=true,invalid=false}={}) {
    this.respond=respond;this.invalid=invalid;this.terminated=false;this.onmessage=null;
  }
  postMessage(payload,transfer){
    if(payload.kind==='probe-init' && this.respond) {
      queueMicrotask(()=>this.onmessage?.({data:{kind:'probe-ready',requestId:payload.requestId}}));
    }
    if(payload.kind==='probe-run' && this.respond) {
      assert.equal(transfer?.[0],payload.data);
      const reply=this.invalid
        ? {kind:'probe-complete',requestId:payload.requestId,bytes:99999}
        : {kind:'probe-complete',requestId:payload.requestId,bytes:payload.data.byteLength,
           processingMs:1,checksum:1};
      structuredClone(payload.data,{transfer});
      queueMicrotask(()=>this.onmessage?.({data:reply}));
    }
  }
  terminate(){this.terminated=true;}
}
test('release is blocked and browser does not assert a fake Trilogy result',async()=>{
  assert.equal(trilogyBrowserReleaseGate().status,'blocked');
  const r=await tryTrilogyBrowserSolve();
  assert.equal(r.status,'unknown'); assert.equal(r.attempted,false);
});
test('Worker stays lazy, transfers exact payload and always terminates',async()=>{
  let worker,created=0;
  const r=await profileTrilogyBrowserWorker({
    sampleBytes:4096,workerFactory:()=>(created++,worker=new FakeWorker()),
  });
  assert.equal(r.status,'probe-complete',r.reason);
  assert.equal(created,1);assert.equal(r.transferredBytes,4096);
  assert.equal(worker.terminated,true);assert.equal(r.peakWorkerRssMiB,null);
});
test('oversized transfer returns unknown before allocating any worker',async()=>{
  let created=0;
  const r=await profileTrilogyBrowserWorker({
    sampleBytes:256*1024+1,workerFactory:()=>{created++;return new FakeWorker();},
  });
  assert.equal(r.reason,'input-budget-rejected');assert.equal(created,0);
});
test('forced deadline terminates stalled worker',async()=>{
  let worker;
  const r=await profileTrilogyBrowserWorker({maxWallMs:25,
    workerFactory:()=>(worker=new FakeWorker({respond:false}))});
  assert.equal(r.reason,'wall-time-budget-exceeded');
  assert.equal(worker.terminated,true);
});
test('AbortSignal termination frees concurrency slot',async()=>{
  const c=new AbortController(); let worker;
  const p=profileTrilogyBrowserWorker({signal:c.signal,maxWallMs:500,
    workerFactory:()=>(worker=new FakeWorker({respond:false}))});
  c.abort();
  assert.equal((await p).reason,'cancelled');
  assert.equal(worker.terminated,true);
  assert.equal((await profileTrilogyBrowserWorker({workerFactory:()=>new FakeWorker()})).status,'probe-complete');
});
test('second worker is forbidden while first worker is active',async()=>{
  let created=0;
  const first=profileTrilogyBrowserWorker({maxWallMs:25,
    workerFactory:()=>{created++;return new FakeWorker({respond:false});}});
  const second=await profileTrilogyBrowserWorker({workerFactory:()=>{created++;return new FakeWorker();}});
  assert.equal(second.reason,'concurrency-budget-rejected');assert.equal(created,1);
  assert.equal((await first).reason,'wall-time-budget-exceeded');
});
test('untrusted worker response fails closed',async()=>{
  const r=await profileTrilogyBrowserWorker({workerFactory:()=>new FakeWorker({invalid:true})});
  assert.equal(r.reason,'invalid-worker-response');
  assert.equal(r.workerTerminated,true);
});
test('already-aborted input never instantiates a Worker',async()=>{
  const c=new AbortController();c.abort();let created=0;
  const r=await profileTrilogyBrowserWorker({signal:c.signal,
    workerFactory:()=>{created++;return new FakeWorker();}});
  assert.equal(r.reason,'cancelled-before-start');assert.equal(created,0);
});
