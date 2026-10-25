/** Session-scoped read-only UCE reports: page all rule hits without chat size caps. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const worker=fileURLToPath(new URL('./agent-report-worker.mjs',import.meta.url));
const MAX_TTL_MS=2*3600_000;
const MAX_REPORTS=10;
const MAX_REPORT_BYTES=128*1024*1024;
export class AgentReportStore {
  #entries=new Map();
  begin(){
    this.sweep();
    if(this.#entries.size>=MAX_REPORTS)
      throw Error('Analysis cache full; release previous report handles.');
    const directory=fs.mkdtempSync(path.join(os.tmpdir(),'uce-mcp-report-'));
    fs.chmodSync(directory,0o700);
    return {directory,file:path.join(directory,'original-uce-report.json')};
  }
  add(session,source){
    const stat=fs.statSync(session.file);
    if(!stat.isFile()||stat.size>MAX_REPORT_BYTES){
      this.abort(session);throw Error('UCE report exceeds temporary result cache policy.');
    }
    const handle=randomBytes(24).toString('hex');
    const entry={...session,source,expires:Date.now()+MAX_TTL_MS};
    try{
      const summary=this.#queryFile(session.file,'summary',0,25);
      this.#entries.set(handle,entry);
      return {reportId:handle,source,summary,
        pagination:{tool:'uce_get_findings',offset:0,limit:25,
          total:summary.evaluatedFindings},
        expiresInSeconds:MAX_TTL_MS/1000};
    }catch(e){this.abort(session);throw e;}
  }
  #queryFile(file,mode,offset,limit){
    const r=spawnSync(process.execPath,[worker,file,mode,String(offset),String(limit)],{
      encoding:'utf8',stdio:['ignore','pipe','pipe'],shell:false,
      timeout:25_000,maxBuffer:3*1024*1024,
      env:{...process.env,UCE_MCP_MAX_REPORT_BYTES:String(MAX_REPORT_BYTES)}});
    if(r.error||r.status!==0)throw Error('UCE report evidence inspection failed safely.');
    return JSON.parse(r.stdout);
  }
  get(id){
    this.sweep();
    if(typeof id!=='string'||!/^[a-f0-9]{48}$/.test(id))
      throw Error('Invalid report handle.');
    const entry=this.#entries.get(id);
    if(!entry)throw Error('Report unavailable or expired.');
    return entry;
  }
  page({reportId,offset=0,limit=25,view='findings'}){
    if(!Number.isSafeInteger(offset)||offset<0||
       !Number.isSafeInteger(limit)||limit<1||limit>100||
       !['summary','findings','rules'].includes(view))
      throw Error('Invalid pagination parameters.');
    const entry=this.get(reportId);
    return {...this.#queryFile(entry.file,view,offset,limit),source:entry.source,
      reportId,storage:'temporary-result-only'};
  }
  release(id){
    const entry=this.get(id);
    this.#entries.delete(id);this.abort(entry);
    return {released:true,reportId:id};
  }
  abort(session){fs.rmSync(session.directory,{recursive:true,force:true});}
  sweep(){
    const now=Date.now();
    for(const [id,entry] of this.#entries){
      if(entry.expires<=now){this.#entries.delete(id);this.abort(entry);}
    }
  }
  close(){
    for(const entry of this.#entries.values())this.abort(entry);
    this.#entries.clear();
  }
}
