#!/usr/bin/env node
/**
 * Single-host, owner-operated MCP HTTP gateway (Node long-running process).
 * Private per-principal workers, bearer SHA-256 auth and explicit ZIP transfer.
 * NOT a multi-tenant SaaS or an OAuth authorization server.
 *
 * Bind loopback only; put behind a trusted HTTPS/auth reverse proxy when
 * connecting a remote client. Never expose raw HTTP on the Internet.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash, timingSafeEqual, randomBytes } from 'node:crypto';
import { uploadHtml } from './upload-ui.mjs';
import { fileURLToPath } from 'node:url';

const stdio=fileURLToPath(new URL('./server.mjs',import.meta.url));
const port=Number(process.env.UCE_MCP_PORT??'8715');
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid UCE_MCP_PORT');
const raw=process.env.UCE_MCP_ACCOUNTS_JSON;
if(!raw)throw Error('UCE_MCP_ACCOUNTS_JSON is required: id, tokenSha256 and dedicated root for each principal.');
const accounts=JSON.parse(raw);
if(!Array.isArray(accounts)||!accounts.length||accounts.length>4)
  throw Error('Only 1–4 explicitly configured principals are permitted.');
const ids=new Set(),hashes=new Set(),roots=new Set();
for(const a of accounts){
  if(!a||typeof a.id!=='string'||!/^[A-Za-z0-9_-]{1,50}$/.test(a.id)||
     typeof a.tokenSha256!=='string'||!/^[a-f0-9]{64}$/.test(a.tokenSha256)||
     typeof a.root!=='string'||!path.isAbsolute(a.root)||
     fs.lstatSync(a.root).isSymbolicLink()||!fs.statSync(a.root).isDirectory())
    throw Error('Invalid principal; each needs id, SHA-256 and existing non-symlink root.');
  const rp=fs.realpathSync(a.root);
  if(ids.has(a.id)||hashes.has(a.tokenSha256)||roots.has(rp))
    throw Error('Shared principal names, tokens and roots are forbidden.');
  ids.add(a.id);hashes.add(a.tokenSha256);roots.add(rp);a.root=rp;
}
const allowedOrigins=new Set((process.env.UCE_MCP_ALLOWED_ORIGINS??'')
  .split(',').map(s=>s.trim()).filter(Boolean));
const clients=new Map();
function authenticate(req){
  const header=req.headers.authorization;
  if(typeof header!=='string'||!/^Bearer [A-Za-z0-9._~+/-]{20,512}=?=?$/.test(header))
    return null;
  const input=Buffer.from(createHash('sha256').update(header.slice(7)).digest('hex'),'hex');
  for(const a of accounts){
    if(timingSafeEqual(input,Buffer.from(a.tokenSha256,'hex')))return a;
  }
  return null;
}
function send(res,status,data,headers={}){
  if(res.writableEnded)return;
  res.writeHead(status,{'cache-control':'no-store','x-content-type-options':'nosniff',
    'content-type':'application/json; charset=utf-8',...headers});
  res.end(JSON.stringify(data));
}
function worker(account){
  const prior=clients.get(account.id);
  if(prior && !prior.dead)return prior;
  const proc=spawn(process.execPath,[stdio,'--root='+account.root],{
    stdio:['pipe','pipe','ignore'],shell:false,cwd:path.dirname(stdio),
    env:{...process.env,UCE_MCP_REMOTE_UPLOAD_ONLY:'1'}
  });
  const context={proc,dead:false,initialized:false,seq:0,pending:new Map(),buf:'',tokens:0,refill:Date.now()};
  const rejectAll=()=>{
    context.dead=true;for(const item of context.pending.values()){
      clearTimeout(item.timer);item.reject(Error('UCE MCP worker ended.'));
    }context.pending.clear();
  };
  proc.on('exit',rejectAll);proc.on('error',rejectAll);
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data',chunk=>{
    context.buf+=chunk;
    if(context.buf.length>2*1024*1024){proc.kill('SIGKILL');return;}
    for(let idx;(idx=context.buf.indexOf('\n'))>=0;){
      const line=context.buf.slice(0,idx);context.buf=context.buf.slice(idx+1);
      try{
        const m=JSON.parse(line),pending=context.pending.get(m.id);
        if(pending){context.pending.delete(m.id);clearTimeout(pending.timer);
          pending.resolve(m);}
      }catch{proc.kill('SIGKILL');return;}
    }
  });
  clients.set(account.id,context);
  return context;
}
function call(account,request,timeout=80000){
  const c=worker(account);
  const now=Date.now();
  if(now-c.refill>60000){c.tokens=0;c.refill=now;}
  if(++c.tokens>300)return Promise.reject(Error('Per-user request quota exceeded.'));
  if(c.pending.size>2)return Promise.reject(Error('Too many concurrent MCP requests.'));
  const id=++c.seq;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{c.pending.delete(id);c.proc.kill('SIGKILL');
      reject(Error('UCE MCP request timed out.'));},timeout);
    c.pending.set(id,{timer,resolve,reject});
    const data=JSON.stringify({...request,id})+'\n';
    if(data.length>64*1024){clearTimeout(timer);c.pending.delete(id);
      reject(Error('MCP request exceeds 64 KiB.'));return;}
    c.proc.stdin.write(data,e=>{
      if(e){clearTimeout(timer);c.pending.delete(id);reject(Error('UCE MCP worker unavailable.'));}});
  });
}
async function tool(account,name,args,timeout=80000){
  const c=worker(account);
  if(!c.initialized){
    const hello=await call(account,{jsonrpc:'2.0',method:'initialize',
      params:{protocolVersion:'2025-06-18',capabilities:{},
        clientInfo:{name:'uce-private-upload-gateway',version:'0.1'}}});
    if(hello.error)throw Error('MCP worker did not initialize.');
    c.initialized=true;
  }
  const message=await call(account,{jsonrpc:'2.0',method:'tools/call',
    params:{name,arguments:args}},timeout);
  if(message.error||message.result?.isError)
    throw Error(message.result?.content?.[0]?.text??'UCE MCP upload tool rejected input.');
  return message.result?.structuredContent;
}
async function readLimited(req,max){
  const header=req.headers['content-length'];
  if(header && (!/^\d+$/.test(header)||Number(header)>max))
    throw Error('Request byte limit exceeded.');
  const parts=[];let len=0;
  for await(const chunk of req){
    len+=chunk.length;if(len>max){req.destroy();throw Error('Request byte limit exceeded.');}
    parts.push(chunk);
  }
  return Buffer.concat(parts,len);
}
const server=http.createServer(async(req,res)=>{
  // DNS rebinding / cross-site browser requests fail closed.
  if(req.headers.origin && !allowedOrigins.has(req.headers.origin)){
    send(res,403,{error:'Origin not permitted'});return;
  }
  if(req.method==='GET'&&req.url==='/health'){
    send(res,200,{status:'ok',mode:'private-upload-mcp-gateway'});return;
  }
  if(req.method==='GET' && req.url==='/upload-ui' &&
     process.env.UCE_MCP_ENABLE_UPLOAD_UI==='1'){
    const nonce=randomBytes(24).toString('base64');
    res.writeHead(200,{'content-type':'text/html; charset=utf-8',
      'cache-control':'no-store','x-content-type-options':'nosniff',
      'x-frame-options':'DENY','referrer-policy':'no-referrer',
      'content-security-policy':"default-src 'none'; script-src 'nonce-"+nonce+
        "'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'"});
    res.end(uploadHtml(nonce));return;
  }
  const account=authenticate(req);
  if(!account){send(res,401,{error:'Bearer authentication required'},
    {'www-authenticate':'Bearer realm="uce-mcp"'});return;}
  if(req.method==='POST'&&req.url==='/mcp'){
    try{
      const bytes=await readLimited(req,64*1024);
      const request=JSON.parse(bytes.toString('utf8'));
      if(!request||request.jsonrpc!=='2.0'||typeof request.method!=='string' ||
         Array.isArray(request)||typeof request!=='object')throw Error('Invalid JSON-RPC request');
      if(!Object.hasOwn(request,'id')){res.writeHead(202,{'cache-control':'no-store'});res.end();return;}
      const result=await call(account,request);
      result.id=request.id;
      send(res,200,result,{'mcp-protocol-version':'2025-06-18'});
    }catch{send(res,400,{error:'Invalid, oversized or unserviceable MCP request'});}
    return;
  }
  if(req.method==='POST'&&req.url==='/upload'){
    if(req.headers['content-type']!=='application/zip'||
       req.headers['x-uce-upload-consent']!=='true'){
      send(res,415,{error:'ZIP content type and explicit consent header required'});return;
    }
    try{
      const bytes=await readLimited(req,4*1024*1024);
      if(bytes.length<4||bytes.readUInt32LE(0)!==0x04034b50)
        throw Error('Not a ZIP archive');
      const sha256=createHash('sha256').update(bytes).digest('hex');
      const filename=typeof req.headers['x-uce-filename']==='string'?
        req.headers['x-uce-filename']:'project.zip';
      let uploadId;
      try{
        const begin=await tool(account,'uce_begin_upload',
          {filename,totalBytes:bytes.length,sha256,confirmDataTransfer:true});
        uploadId=begin.uploadId;
        for(let pos=0;pos<bytes.length;pos+=24*1024){
          await tool(account,'uce_upload_chunk',
            {uploadId,base64Chunk:bytes.subarray(pos,pos+24*1024).toString('base64')});
        }
        const sealed=await tool(account,'uce_finish_upload',{uploadId});
        send(res,201,{uploadId,status:sealed.status,sha256,
          expiresInSeconds:sealed.expiresInSeconds,
          next:'Invoke uce_analyze_upload with this handle from the SAME authenticated user.'});
      }catch{
        if(uploadId)await tool(account,'uce_delete_upload',{uploadId}).catch(()=>{});
        throw Error('Upload validation failed');
      }
    }catch{send(res,400,{error:'ZIP upload failed validation or resource limits'});}
    return;
  }
  send(res,404,{error:'Unknown path'});
});
server.listen(port,'127.0.0.1',()=>process.stderr.write(
  'UCE private MCP gateway listening on loopback only; HTTPS reverse proxy required for remote clients.\n'));
process.on('SIGTERM',()=>{server.close();
  for(const c of clients.values())c.proc.kill('SIGTERM');});
