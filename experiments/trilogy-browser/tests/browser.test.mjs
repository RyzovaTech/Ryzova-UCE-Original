import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
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
