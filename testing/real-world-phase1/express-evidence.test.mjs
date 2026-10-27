import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('./express-evidence.mjs',import.meta.url));
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uce-express-evidence-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const src=path.join(dir,'src');fs.mkdirSync(src);
 fs.writeFileSync(path.join(src,'app.js'),'export const ok=true;\n');
 const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8'}).trim();
 git('init','-q');git('add','src/app.js');
 git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','pin source');
 const commit=git('rev-parse','HEAD');
 const report={score:{overall:98},issues:[
 {id:'signal-1',title:'Example candidate, not validated',category:'runtime',
  severity:'warning',affectedFile:'src/app.js:1'},
 {id:'signal-2',title:'Unmapped source',severity:'info',
  category:'configuration',affectedFile:'does/not/exist.ts:1'}]};
 const input=path.join(dir,'report.json'),out=path.join(dir,'result.json');
 fs.writeFileSync(input,JSON.stringify(report));
 const cmd=(sha=commit)=>spawnSync(process.execPath,[script,'--report='+input,
  '--checkout='+dir,'--sha='+sha,'--output='+out],{encoding:'utf8'});
 return {dir,src,commit,report,input,out,cmd};
}
test('pinned public file evidence is not a confirmed compatibility defect',t=>{
 const f=fixture(t),p=f.cmd();
 assert.equal(p.status,0,p.stderr);
 const r=JSON.parse(fs.readFileSync(f.out,'utf8'));
 assert.equal(r.originalUCEReportedScore,98);
 assert.equal(r.originalUCEIssueCount,2);
 assert.equal(r.findings[0].sourceStatus,'pinned-file-bytes-match');
 assert.equal(r.findings[1].sourceStatus,'source-file-not-verified');
 assert.equal(r.findings[0].independentlyConfirmedDefect,false);
 assert.equal(r.independentRealWorldAccuracy,null);
 assert.equal(r.releaseReady,false);
 assert.equal(r.sourceLinkedFindingCount,1);
});
test('moving or changing checkout fails closed',t=>{
 const f=fixture(t);assert.notEqual(f.cmd('a'.repeat(40)).status,0);
 fs.writeFileSync(path.join(f.src,'app.js'),'changed working tree');
 const p=f.cmd();assert.equal(p.status,0,p.stderr);
 const r=JSON.parse(fs.readFileSync(f.out,'utf8'));
 assert.equal(r.findings[0].sourceStatus,'checkout-does-not-match-pinned-blob');
 assert.equal(r.sourceLinkedFindingCount,0);
});
test('cannot overwrite prior evidence file',t=>{
 const f=fixture(t);assert.equal(f.cmd().status,0);
 const original=fs.readFileSync(f.out);
 assert.notEqual(f.cmd().status,0);
 assert.deepEqual(fs.readFileSync(f.out),original);
});
