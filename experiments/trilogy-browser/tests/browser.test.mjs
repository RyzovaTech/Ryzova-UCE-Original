import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const base='http://127.0.0.1:4174/experiments/trilogy-browser/index.html';

test('real Chromium: lazy Worker and fail-closed solver gate',async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage();await page.goto(base,{waitUntil:'networkidle'});
    assert.equal(await page.locator('html').getAttribute('data-trilogy-gate'),'blocked');
    const r=await page.evaluate(async()=>{
      const m=await import('/experiments/trilogy-browser/controller.mjs');
      return {probe:await m.profileTrilogyBrowserWorker({sampleBytes:65536}),
        solver:await m.tryTrilogyBrowserSolve(),isolated:crossOriginIsolated};
    });
    assert.equal(r.probe.status,'probe-complete',JSON.stringify(r.probe));
    assert.equal(r.probe.transferredBytes,65536);
    assert.equal(r.probe.workerTerminated,true);
    assert.equal(r.solver.status,'unknown');
    assert.equal(r.isolated,false);
  }finally{await browser.close();}
});

test('real Chromium: wall deadline, abort and recovery',async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage();await page.goto(base,{waitUntil:'networkidle'});
    const r=await page.evaluate(async()=>{
      const m=await import('/experiments/trilogy-browser/controller.mjs');
      const timeout=await m.profileTrilogyBrowserWorker({sampleBytes:1024,stallMs:1500,maxWallMs:200});
      const c=new AbortController();
      const pending=m.profileTrilogyBrowserWorker({sampleBytes:1024,stallMs:1500,
        maxWallMs:2000,signal:c.signal});
      setTimeout(()=>c.abort(),50);
      const cancelled=await pending;
      const recovered=await m.profileTrilogyBrowserWorker({sampleBytes:4096});
      return {timeout,cancelled,recovered};
    });
    assert.equal(r.timeout.reason,'wall-time-budget-exceeded',JSON.stringify(r));
    assert.equal(r.cancelled.reason,'cancelled');
    assert.equal(r.timeout.workerTerminated,true);
    assert.equal(r.cancelled.workerTerminated,true);
    assert.equal(r.recovered.status,'probe-complete',JSON.stringify(r));
  }finally{await browser.close();}
});

test('real Chromium: benchmark six cold-start Workers and 1.5MiB transferred',async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage();await page.goto(base,{waitUntil:'networkidle'});
    const r=await page.evaluate(async()=>{
      const m=await import('/experiments/trilogy-browser/controller.mjs');
      const results=[];
      for(let i=0;i<6;i++) results.push(await m.profileTrilogyBrowserWorker({sampleBytes:256*1024}));
      const mean=key=>Math.round(results.reduce((s,x)=>s+x[key],0)/results.length*100)/100;
      return {
        complete:results.every(x=>x.status==='probe-complete'&&x.workerTerminated),
        meanStartupMs:mean('startupMs'),
        meanRoundTripMs:mean('totalMs'),
        maxRoundTripMs:Math.max(...results.map(x=>x.totalMs)),
        transferredBytes:results.reduce((s,x)=>s+x.transferredBytes,0),
        reportedPeakWorkerRssMiB:results[0].peakWorkerRssMiB,
        warning:results[0].memoryMeasurement,
      };
    });
    assert.equal(r.complete,true,JSON.stringify(r));
    assert.equal(r.transferredBytes,6*256*1024);
    assert.equal(r.reportedPeakWorkerRssMiB,null);
    assert.ok(r.maxRoundTripMs<3000);
    console.log('UCE real Chromium Worker startup/transfer measurements (NOT Trilogy solver): '+JSON.stringify(r));
  }finally{await browser.close();}
});


function processTreeRssMiB(rootPid) {
  if (process.platform !== 'linux' || !Number.isInteger(rootPid)) return null;
  const queue=[rootPid], visited=new Set();
  let sumKb=0;
  while(queue.length && visited.size<128){
    const pid=queue.shift();
    if(visited.has(pid)) continue;
    visited.add(pid);
    try{
      const status=readFileSync('/proc/'+pid+'/status','utf8');
      const rss=/^VmRSS:\s+(\d+)\s+kB/m.exec(status);
      if(rss) sumKb+=Number(rss[1]);
      const children=readFileSync('/proc/'+pid+'/task/'+pid+'/children','utf8').trim();
      if(children) queue.push(...children.split(/\s+/).map(Number).filter(Number.isInteger));
    }catch{ /* Process may terminate during sampling. */ }
  }
  return sumKb>0 ? Math.round(sumKb/1024*100)/100 : null;
}

test('real Chromium Linux sampled browser-process tree RSS during Worker churn',async(t)=>{
  if(process.platform!=='linux'){t.skip('RSS sampling is Linux /proc-specific');return;}
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const pid=browser.process()?.pid;
    assert.ok(Number.isInteger(pid),'Chromium process PID not exposed');
    const page=await browser.newPage();await page.goto(base,{waitUntil:'networkidle'});
    const before=processTreeRssMiB(pid);
    assert.ok(before!==null,'Cannot sample Linux browser process memory');
    const samples=[before];
    const sampler=setInterval(()=>{
      const rss=processTreeRssMiB(pid);
      if(rss!==null) samples.push(rss);
    },25);
    let runs;
    try{
      runs=await page.evaluate(async()=>{
        const m=await import('/experiments/trilogy-browser/controller.mjs');
        const data=[];
        for(let i=0;i<16;i++) data.push(await m.profileTrilogyBrowserWorker({sampleBytes:256*1024}));
        return data.map(x=>({status:x.status,ms:x.totalMs,terminated:x.workerTerminated}));
      });
    }finally{clearInterval(sampler);}
    const after=processTreeRssMiB(pid);
    if(after!==null) samples.push(after);
    assert.ok(runs.every(x=>x.status==='probe-complete'&&x.terminated));
    const diagnostic={
      type:'chromium-process-tree-rss-worker-churn-diagnostic',
      samples:runs.length,
      bytesTransferred:runs.length*256*1024,
      workerMeanRoundTripMs:Math.round(runs.reduce((s,x)=>s+x.ms,0)/runs.length*100)/100,
      baselineAggregateProcessRssMiB:before,
      maxSampledAggregateProcessRssMiB:Math.max(...samples),
      afterAggregateProcessRssMiB:after,
      rssSamples:samples.length,
      caveat:'Linux sum of Chromium process-family RSS includes renderer, utilities and shared pages, may double-count; NOT standalone Worker RSS, unique memory, peak WASM heap, or a hard cap.',
    };
    const dir=fileURLToPath(new URL('../metrics/',import.meta.url));
    mkdirSync(dir,{recursive:true});
    writeFileSync(resolve(dir,'latest-browser-memory.json'),JSON.stringify(diagnostic,null,2)+'\n');
    console.log('UCE real Chromium sampled browser process-family RSS: '+JSON.stringify(diagnostic));
    assert.ok(diagnostic.rssSamples>=2);
  }finally{await browser.close();}
});
