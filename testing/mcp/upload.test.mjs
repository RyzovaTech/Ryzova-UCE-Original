import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import JSZip from 'jszip';

const root=fileURLToPath(new URL('../../',import.meta.url));
const server=path.join(root,'tools/mcp/server.mjs');
const gateway=path.join(root,'tools/mcp/http-server.mjs');
const method=(id,method,params)=>({jsonrpc:'2.0',id,method,params});
const uploadTool=(id,name,args)=>method(id,'tools/call',{name,arguments:args});
const hash=b=>createHash('sha256').update(b).digest('hex');
async function archive(bad=false){
  const z=new JSZip();
  z.file('package.json',JSON.stringify({name:'uploaded-project',
    version:'1.0.0',engines:{node:'>=22'},dependencies:{react:'^19.0.0'}}));
  z.file('.nvmrc','20.0.0\n');
  if(bad)z.file('../escape.txt','escape');
  return z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
function start(dir,remoteOnly=false){
  const p=spawn(process.execPath,[server,'--root='+dir],{
    cwd:root,stdio:['pipe','pipe','pipe'],env:{...process.env,
      ...(remoteOnly?{UCE_MCP_REMOTE_UPLOAD_ONLY:'1'}:{})}});
  const pending=new Map(),lines=createInterface({input:p.stdout});
  lines.on('line',line=>{
    let obj;
    try{obj=JSON.parse(line);}catch{p.kill();return;}
    const fn=pending.get(obj.id);
    if(fn){pending.delete(obj.id);fn(obj);}
  });
  let seq=0;
  return {process:p,async send(name,params={}){
    const id=++seq;
    return Promise.race([
      new Promise((resolve,reject)=>{
        pending.set(id,resolve);
        p.stdin.write(JSON.stringify(method(id,name,params))+'\n',e=>{if(e)reject(e);});
      }),
      new Promise((_,reject)=>setTimeout(()=>reject(Error('stdio MCP timeout')),30000)),
    ]);
  },async tool(name,args){return this.send('tools/call',{name,arguments:args});},
  close(){p.kill('SIGTERM');lines.close();}};
}
test('inline user-owned text inputs are staged, analyzed and reported without code execution',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uce-mcp-inline-'));
 const c=start(dir);
 try{
  await c.send('initialize',{protocolVersion:'2025-06-18'});
  const r=await c.tool('uce_analyze_text_files',{files:[
    {path:'package.json',content:JSON.stringify({name:'sample',version:'1.0.0',engines:{node:'>=22'}})},
    {path:'.nvmrc',content:'20.0.0\n'}]});
  assert.equal(r.result.isError,false,JSON.stringify(r));
  const x=r.result.structuredContent;
  assert.equal(x.quality.scoreParity,'preserved');
  assert.equal(x.quality.humanAccuracy,'not-measured');
  assert.equal(x.upload.temporaryBytesErased,true);
  assert.equal(fs.readdirSync(dir).length,0,'inline upload must not modify the user root');
  const reject=await c.tool('uce_analyze_text_files',{files:[
    {path:'../outside.js',content:'danger'}]});
  assert.equal(reject.result.isError,true);
 }finally{c.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('checksum-verified chunked ZIP, expiry handle, source scan and removal',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uce-mcp-zips-'));const c=start(dir);
 try{
  await c.send('initialize',{protocolVersion:'2025-06-18'});
  const bytes=await archive();
  const before=await c.tool('uce_begin_upload',{filename:'project.zip',totalBytes:bytes.length,
    sha256:hash(bytes),confirmDataTransfer:false});
  assert.equal(before.result.isError,true);
  const begin=await c.tool('uce_begin_upload',{filename:'project.zip',
    totalBytes:bytes.length,sha256:hash(bytes),confirmDataTransfer:true});
  assert.equal(begin.result.isError,false);
  const id=begin.result.structuredContent.uploadId;
  for(let pos=0;pos<bytes.length;pos+=1024){
    const chunk=await c.tool('uce_upload_chunk',{uploadId:id,
      base64Chunk:bytes.subarray(pos,pos+1024).toString('base64')});
    assert.equal(chunk.result.isError,false,JSON.stringify(chunk));
  }
  const sealed=await c.tool('uce_finish_upload',{uploadId:id});
  assert.equal(sealed.result.structuredContent.sha256,hash(bytes));
  const scanned=await c.tool('uce_analyze_upload',{uploadId:id,maxIssues:10});
  assert.equal(scanned.result.isError,false,JSON.stringify(scanned));
  assert.equal(scanned.result.structuredContent.quality.issueParity,'preserved');
  assert.equal(scanned.result.structuredContent.upload.files>=1,true);
  const again=await c.tool('uce_analyze_upload',{uploadId:id});
  assert.equal(again.result.isError,true,'analyzed staging cannot be replayed');
  assert.deepEqual(fs.readdirSync(dir),[],'uploaded ZIP must not persist in authorized root');
 }finally{c.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('ZIP source traversal and secret-bearing .env are not accepted as source',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uce-mcp-zip-guard-'));
 const c=start(dir);
 try{
  await c.send('initialize',{protocolVersion:'2025-06-18'});
  for(const invalid of [true,false]){
   const z=new JSZip();
   if(invalid)z.file('../outside.txt','escape');
   else z.file('.env','SECRET=not-for-analysis');
   const archiveBytes=await z.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
   const begun=await c.tool('uce_begin_upload',{filename:'bad.zip',
     totalBytes:archiveBytes.length,sha256:hash(archiveBytes),confirmDataTransfer:true});
   const handle=begun.result.structuredContent.uploadId;
   await c.tool('uce_upload_chunk',{uploadId:handle,base64Chunk:archiveBytes.toString('base64')});
   await c.tool('uce_finish_upload',{uploadId:handle});
   const scanned=await c.tool('uce_analyze_upload',{uploadId:handle});
   assert.equal(scanned.result.isError,true,'unsafe archive should be rejected');
  }
  assert.equal(fs.existsSync(path.join(dir,'outside.txt')),false);
 }finally{c.close();fs.rmSync(dir,{recursive:true,force:true});}
});
async function freePort(){
 const n=net.createServer();
 await new Promise(r=>n.listen(0,'127.0.0.1',r));
 const port=n.address().port;
 await new Promise(r=>n.close(r));return port;
}
test('HTTP remote bridge enforces authentication and tenant upload isolation',async()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'uce-mcp-http-'));
 const dirs=['alice','bob'].map(x=>path.join(base,x));
 dirs.forEach(dir=>fs.mkdirSync(dir));
 const tokenA=randomBytes(32).toString('hex'),tokenB=randomBytes(32).toString('hex');
 const port=await freePort();
 const processChild=spawn(process.execPath,[gateway],{
   cwd:root,stdio:['ignore','ignore','pipe'],
   env:{...process.env,UCE_MCP_PORT:String(port),UCE_MCP_ENABLE_UPLOAD_UI:'1',
     UCE_MCP_ALLOWED_ORIGINS:'https://uce.example.test',
     UCE_MCP_ACCOUNTS_JSON:JSON.stringify([
     {id:'alice',tokenSha256:hash(tokenA),root:dirs[0]},
     {id:'bob',tokenSha256:hash(tokenB),root:dirs[1]},
   ])}
 });
 const endpoint='http://127.0.0.1:'+port;
 async function request(url,token,init={}){
  return fetch(endpoint+url,{...init,headers:{...(token?{Authorization:'Bearer '+token}:{}),
    ...init.headers},signal:AbortSignal.timeout(30000)});
 }
 async function mcp(token,id,meth,params={}){
  const r=await request('/mcp',token,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(method(id,meth,params))});
  return {status:r.status,body:await r.json()};
 }
 try{
  let healthy=false;
  for(let i=0;i<80;i++){
    if(processChild.exitCode!==null)throw Error('Gateway exited');
    try{const r=await fetch(endpoint+'/health');if(r.ok){healthy=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(healthy,true);
  const browserForm=await fetch(endpoint+'/upload-ui');
  assert.equal(browserForm.status,200);
  assert.match(browserForm.headers.get('content-security-policy')??'',
    /script-src 'nonce-/);
  assert.match(await browserForm.text(),/Private project ZIP upload/);
  const disallowedOrigin=await request('/upload',tokenA,{method:'POST',
    headers:{Origin:'https://evil.example','content-type':'application/zip',
      'x-uce-upload-consent':'true'},
    body:await archive()});
  assert.equal(disallowedOrigin.status,403);
  const unauthorized=await request('/mcp',null,{method:'POST',headers:{
    'Content-Type':'application/json'},body:JSON.stringify(method(1,'initialize',{}))});
  assert.equal(unauthorized.status,401);
  const rebound=await request('/mcp',tokenA,{method:'POST',headers:{
    Origin:'https://evil.example','Content-Type':'application/json'},
    body:JSON.stringify(method(1,'initialize',{}))});
  assert.equal(rebound.status,403);
  const init=await mcp(tokenA,1,'initialize',{protocolVersion:'2025-06-18'});
  assert.equal(init.status,200);
  const list=await mcp(tokenA,2,'tools/list');
  assert.ok(list.body.result.tools.some(t=>t.name==='uce_analyze_upload'));
  assert.ok(!list.body.result.tools.some(t=>t.name==='uce_scan_project'));
  const bytes=await archive();
  const up=await request('/upload',tokenA,{method:'POST',headers:{
    'content-type':'application/zip','x-uce-upload-consent':'true',
    'x-uce-filename':'my-project.zip'},body:bytes});
  const responseText=await up.text();
  assert.equal(up.status,201,responseText);
  const uploaded=JSON.parse(responseText);
  await mcp(tokenB,1,'initialize',{protocolVersion:'2025-06-18'});
  const stolen=await mcp(tokenB,2,'tools/call',{
    name:'uce_analyze_upload',arguments:{uploadId:uploaded.uploadId}});
  assert.equal(stolen.body.result.isError,true);
  const own=await mcp(tokenA,3,'tools/call',{name:'uce_analyze_upload',
    arguments:{uploadId:uploaded.uploadId}});
  assert.equal(own.body.result.isError,false,JSON.stringify(own));
  assert.equal(own.body.result.structuredContent.upload.temporaryBytesErased,true);
  assert.deepEqual(fs.readdirSync(dirs[0]),[]);
  assert.deepEqual(fs.readdirSync(dirs[1]),[]);
 }finally{processChild.kill('SIGTERM');fs.rmSync(base,{recursive:true,force:true});}
});

test('wrong upload checksum invalidates handle and oversized claims are refused',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uce-mcp-checksum-'));const c=start(dir);
 try{
  await c.send('initialize',{protocolVersion:'2025-06-18'});
  const bytes=await archive();
  const big=await c.tool('uce_begin_upload',{filename:'large.zip',totalBytes:4194305,
    sha256:hash(bytes),confirmDataTransfer:true});
  assert.equal(big.result.isError,true);
  const begin=await c.tool('uce_begin_upload',{filename:'incorrect.zip',
    totalBytes:bytes.length,sha256:'0'.repeat(64),confirmDataTransfer:true});
  const handle=begin.result.structuredContent.uploadId;
  const chunk=await c.tool('uce_upload_chunk',{uploadId:handle,
    base64Chunk:bytes.toString('base64')});
  assert.equal(chunk.result.isError,false);
  const finish=await c.tool('uce_finish_upload',{uploadId:handle});
  assert.equal(finish.result.isError,true);
  const replay=await c.tool('uce_upload_status',{uploadId:handle});
  assert.equal(replay.result.isError,true,'checksum failure must discard staged ZIP');
 }finally{c.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('ZIP POSIX symlink records cannot escape extraction or be analyzed',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'uce-mcp-symlink-'));const c=start(dir);
 try{
  await c.send('initialize',{protocolVersion:'2025-06-18'});
  const z=new JSZip();
  z.file('package.json','{"name":"sample","version":"1.0.0"}');
  z.file('linked.js','../outside.js',{unixPermissions:0o120777});
  const bytes=await z.generateAsync({type:'nodebuffer',compression:'DEFLATE',platform:'UNIX'});
  const begin=await c.tool('uce_begin_upload',{filename:'symlink.zip',
    totalBytes:bytes.length,sha256:hash(bytes),confirmDataTransfer:true});
  const id=begin.result.structuredContent.uploadId;
  await c.tool('uce_upload_chunk',{uploadId:id,base64Chunk:bytes.toString('base64')});
  await c.tool('uce_finish_upload',{uploadId:id});
  const x=await c.tool('uce_analyze_upload',{uploadId:id});
  assert.equal(x.result.isError,true);
  assert.equal(fs.existsSync(path.join(dir,'outside.js')),false);
 }finally{c.close();fs.rmSync(dir,{recursive:true,force:true});}
});
