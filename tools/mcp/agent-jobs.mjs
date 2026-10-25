/**
 * User-isolated local MCP scan jobs: avoid client/chat tool HTTP timeouts.
 * These are custom UCE tools, not an assertion of support for the optional
 * MCP Tasks extension in arbitrary ChatGPT/Claude client versions.
 */
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseRepositoryUrl,validatedBudget} from './repository-scan.mjs';
const worker=fileURLToPath(new URL('./repo-job-worker.mjs',import.meta.url));
const JOB_TTL_MS=2*3600_000;
function killTree(proc){
 if(!proc||!proc.pid)return;
 try{
  if(process.platform!=='win32')process.kill(-proc.pid,'SIGKILL');
  else proc.kill('SIGKILL');
 }catch{try{proc.kill('SIGKILL');}catch{}}
}
export class AgentJobs {
  #jobs=new Map();
  constructor(reportStore){this.store=reportStore;}
  start(args){
    this.sweep();
    const hosts=(process.env.UCE_MCP_GIT_HOSTS??'github.com,gitlab.com,codeberg.org')
      .split(',').map(x=>x.trim()).filter(Boolean);
    parseRepositoryUrl(args?.repository,hosts);
    validatedBudget(args?.maxFiles,'maxFiles');
    validatedBudget(args?.maxBytes,'maxBytes');
    if(this.#jobs.size>=6||[...this.#jobs.values()].filter(j=>j.status==='running').length>=2)
      throw Error('Machine is busy; check or release existing scans before starting another.');
    const session=this.store.begin();
    const jobId=randomBytes(24).toString('hex');
    const job={status:'running',startedAt:new Date().toISOString(),
      created:Date.now(),session,result:null,proc:null,
      stdout:'',completedAt:null,error:null};
    this.#jobs.set(jobId,job);
    try{
      const child=spawn(process.execPath,[worker,JSON.stringify(args),session.file],{
        cwd:fileURLToPath(new URL('../../',import.meta.url)),stdio:['ignore','pipe','ignore'],
        detached:process.platform!=='win32',
        env:{...process.env,UCE_MCP_WORK_ROOT:session.directory},shell:false});
      job.proc=child;
      const timer=setTimeout(()=>{job.error='Machine time limit reached';killTree(child);},
        9*60_000);
      timer.unref();
      child.stdout.setEncoding('utf8');
      child.stdout.on('data',chunk=>{
        job.stdout+=chunk;
        if(job.stdout.length>32768){job.error='Scan metadata too large';killTree(child);}
      });
      child.on('error',()=>{job.error='Scan worker could not start';});
      child.on('close',code=>{
        clearTimeout(timer);
        job.proc=null;
        job.completedAt=new Date().toISOString();
        if(job.status==='cancelled'){this.store.abort(session);return;}
        if(code!==0||job.error){
          job.status='failed';job.error=job.error??'Public Git repository scan failed';
          this.store.abort(session);return;
        }
        try{
          const metadata=JSON.parse(job.stdout);
          job.result=this.store.add(session,metadata);
          job.status='completed';
        }catch{
          job.status='failed';job.error='UCE results validation failed';
          this.store.abort(session);
        }
      });
      return {jobId,status:'running',pollTool:'uce_repository_scan_status',
        pollIntervalMs:3000,transport:'nonblocking agent job',estimatedSeconds:null,
        source:'public-HTTPS-Git',paywall:false};
    }catch{
      this.#jobs.delete(jobId);this.store.abort(session);
      throw Error('Could not start repository scan');
    }
  }
  #get(id){
    this.sweep();
    if(typeof id!=='string'||!/^[a-f0-9]{48}$/.test(id))throw Error('Invalid job handle');
    const j=this.#jobs.get(id);
    if(!j)throw Error('Repository scan job expired or not found');
    return j;
  }
  status(id){
    const j=this.#get(id);
    return {jobId:id,status:j.status,startedAt:j.startedAt,
      completedAt:j.completedAt,...(j.status==='completed'?{result:j.result}:{}),
      ...(j.status==='failed'?{error:j.error}:{}),pollIntervalMs:3000};
  }
  cancel(id){
    const j=this.#get(id);
    if(j.status==='running'){
      j.status='cancelled';j.error='Cancelled by requester';
      killTree(j.proc);
      // The checkout lives under session.directory; close handler erases it
      // after the process group has terminated, not while Git may still write.
      return {jobId:id,status:'cancelled',sourceContentRetained:false};
    }
    return {jobId:id,status:j.status,alreadyFinished:true};
  }
  sweep(){
    const now=Date.now();
    for(const [id,j] of this.#jobs){
      if(now-j.created>JOB_TTL_MS){
        if(j.status==='running')killTree(j.proc);
        if(j.status==='running')j.status='cancelled';
        // Process close handler removes its entire temporary directory.
        this.#jobs.delete(id);
      }
    }
  }
  close(){
    for(const j of this.#jobs.values())if(j.status==='running')killTree(j.proc);
    this.#jobs.clear();
  }
}
