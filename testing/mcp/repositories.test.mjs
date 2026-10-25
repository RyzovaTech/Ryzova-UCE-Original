import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {parseRepositoryUrl, validatedBudget} from '../../tools/mcp/repository-scan.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const server=path.join(root,'tools/mcp/server.mjs');
function harness(workspace){
 const proc=spawn(process.execPath,[server,'--root='+workspace],{
   cwd:root,stdio:['pipe','pipe','pipe'],env:process.env});
 const rl=createInterface({input:proc.stdout}),pending=new Map();
 rl.on('line',line=>{
   try{const result=JSON.parse(line);
     const done=pending.get(result.id);
     if(done){pending.delete(result.id);done(result);}
   }catch{proc.kill('SIGKILL');}
 });
 let id=0;
 return {
   async send(method,params={}){
     const next=++id;
     return Promise.race([
       new Promise((resolve,reject)=>{
         pending.set(next,resolve);
         proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:next,method,params})+'\n',e=>e&&reject(e));
       }),
       new Promise((_,reject)=>setTimeout(()=>reject(Error('MCP repository tool timeout')),150000))
     ]);
   },
   async tool(name,args){return this.send('tools/call',{name,arguments:args});},
   close(){proc.kill('SIGTERM');rl.close();}
 };
}
test('Git URL canonicalization allows GitHub, GitLab and Codeberg but rejects unsafe inputs',()=>{
 assert.equal(parseRepositoryUrl('pallets/click').url,'https://github.com/pallets/click.git');
 assert.equal(parseRepositoryUrl('https://gitlab.com/group/project.git').url,
   'https://gitlab.com/group/project.git');
 assert.equal(parseRepositoryUrl('https://codeberg.org/owner/repo').url,
   'https://codeberg.org/owner/repo.git');
 for(const invalid of [
  'file:///etc/passwd','http://github.com/pallets/click','https://127.0.0.1/repo/x',
  'https://github.com@evil.example/path/repo','https://github.com/path/../repo',
  'https://github.com/path/repo?x=1','https://github.com:8443/path/repo',
  'git@github.com:pallets/click.git','https://github.com/a/%2e%2e',
  'https://github.com/a/repo#secret'
 ])assert.throws(()=>parseRepositoryUrl(invalid),invalid);
 assert.equal(validatedBudget(undefined,'maxFiles'),25000);
 assert.equal(validatedBudget(undefined,'maxBytes'),96*1024*1024);
 assert.equal(validatedBudget(100000,'maxFiles'),100000);
 assert.throws(()=>validatedBudget(100001,'maxFiles'));
});
test('Gitless full local workspace scan uses all UCE rules and paginates real evidence',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uce-mcp-project-'));
 fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({
    name:'agent-repro',version:'1.0.0',engines:{node:'>=22'},
    dependencies:{react:'^19.0.0'},scripts:{test:'echo untrusted-never-run'}}));
 fs.writeFileSync(path.join(dir,'.nvmrc'),'20.0.0\n');
 const before=fs.readdirSync(dir).sort();
 const c=harness(dir);
 try{
  const initialized=await c.send('initialize',{protocolVersion:'2025-06-18'});
  assert.equal(initialized.result.serverInfo.name,'ryzova-uce-mcp');
  const result=await c.tool('uce_scan_workspace',{projectPath:'.'});
  assert.equal(result.result.isError,false,JSON.stringify(result));
  const value=result.result.structuredContent;
  assert.equal(value.source.source.type,'authorized-local-checkout');
  assert.equal(value.source.coverage.maxFiles,25000);
  assert.equal(value.summary.structuralParity.issues,'preserved');
  assert.equal(value.summary.humanAccuracy,'not-measured');
  assert.equal(value.summary.nativeTrilogyExecuted,false);
  const reportId=value.reportId;
  assert.match(reportId,/^[a-f0-9]{48}$/);
  const summary=await c.tool('uce_rule_summary',{reportId});
  assert.equal(summary.result.isError,false);
  assert.equal(summary.result.structuredContent.score,value.summary.score);
  let offset=0,count=0;
  for(let page=0;page<100;page++){
   const returned=await c.tool('uce_get_findings',{reportId,offset,limit:2});
   assert.equal(returned.result.isError,false,JSON.stringify(returned));
   const data=returned.result.structuredContent;
   count+=data.items.length;
   offset+=data.items.length;
   if(!data.hasMore)break;
   assert.ok(data.items.length>0);
  }
  assert.equal(count,value.summary.evaluatedFindings,
   'paginated findings must cover full original UCE rule output');
  const released=await c.tool('uce_release_report',{reportId});
  assert.equal(released.result.structuredContent.released,true);
  const gone=await c.tool('uce_get_findings',{reportId});
  assert.equal(gone.result.isError,true);
  assert.deepEqual(fs.readdirSync(dir).sort(),before,
   'UCE agent must not write into user project');
 }finally{c.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('Pinned real GitHub repository can be analyzed without ZIP or chat attachments',{
 skip:process.env.UCE_MCP_GIT_SMOKE!=='1'},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uce-mcp-git-test-'));
 const c=harness(dir);
 try{
  await c.send('initialize',{protocolVersion:'2025-06-18'});
  const commit='2247b35ea1c47c727d7a06e51fa280e12a863ff6';
  const r=await c.tool('uce_scan_repository',{
    repository:'pallets/click',ref:commit});
  assert.equal(r.result.isError,false,JSON.stringify(r));
  const value=r.result.structuredContent;
  assert.equal(value.source.source.commit,commit);
  assert.equal(value.source.source.repository,'github.com/pallets/click');
  assert.equal(value.summary.structuralParity.score,'preserved');
  assert.ok(value.source.coverage.filesFound>0);
  const x=await c.tool('uce_rule_summary',{reportId:value.reportId});
  assert.equal(x.result.isError,false);
  await c.tool('uce_release_report',{reportId:value.reportId});
  assert.deepEqual(fs.readdirSync(dir),[],'Public checkout must not be retained inside root');
 }finally{c.close();fs.rmSync(dir,{recursive:true,force:true});}
});
