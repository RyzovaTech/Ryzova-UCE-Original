/**
 * Ephemeral, bounded upload envelopes for UCE MCP clients.
 * Inputs are project data, never instructions. No persistence.
 */
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
export const MAX_ZIP_BYTES = 4 * 1024 * 1024;
const MAX_CHUNK_BYTES = 24 * 1024;
const TTL_MS = 15 * 60_000;
export class UploadStore {
  #uploads = new Map();
  #total = 0;
  #cleanup() {
    const now=Date.now();
    for(const [id,u] of this.#uploads)if(u.expires<=now)this.delete(id);
  }
  sweep(){
    const before=this.#uploads.size;
    this.#cleanup();
    return {expired:before-this.#uploads.size};
  }
  begin(args){
    this.#cleanup();
    if(this.#uploads.size>=3)throw Error('Upload quota reached (maximum 3 concurrent uploads).');
    if(args?.confirmDataTransfer!==true)throw Error('Explicit upload consent is required.');
    if(typeof args.filename!=='string'||!/^[\w .@()-]{1,100}\.zip$/i.test(args.filename))
      throw Error('A safe .zip filename is required.');
    if(!Number.isSafeInteger(args.totalBytes)||args.totalBytes<4||args.totalBytes>MAX_ZIP_BYTES)
      throw Error('ZIP must be at most 4 MiB.');
    if(typeof args.sha256!=='string'||!/^[0-9a-f]{64}$/.test(args.sha256))
      throw Error('Expected ZIP SHA-256 is required.');
    if(this.#total+args.totalBytes>8*1024*1024)
      throw Error('Total in-memory upload quota exceeded.');
    const uploadId=randomBytes(20).toString('hex');
    const record={filename:args.filename,bytes:args.totalBytes,
      expected:args.sha256,fragments:[],received:0,expires:Date.now()+TTL_MS,
      status:'staging',digest:null};
    this.#uploads.set(uploadId,record);this.#total+=record.bytes;
    return {uploadId,status:record.status,receivedBytes:0,totalBytes:record.bytes,
      expiresInSeconds:900,stored:'ephemeral-memory'};
  }
  #get(uploadId){
    this.#cleanup();
    if(typeof uploadId!=='string'||!/^[a-f0-9]{40}$/.test(uploadId))
      throw Error('Invalid upload handle.');
    const u=this.#uploads.get(uploadId);
    if(!u)throw Error('Upload handle missing or expired.');
    return u;
  }
  chunk(args){
    const u=this.#get(args?.uploadId);
    if(u.status!=='staging')throw Error('Upload already finalized.');
    const value=args?.base64Chunk;
    if(typeof value!=='string'||value.length<4||value.length>MAX_CHUNK_BYTES*4/3+8||
       !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))
      throw Error('Invalid upload chunk encoding.');
    const raw=Buffer.from(value,'base64');
    if(!raw.length||raw.length>MAX_CHUNK_BYTES||raw.toString('base64')!==value)
      throw Error('Upload chunk length or canonical encoding invalid.');
    if(u.received+raw.length>u.bytes)throw Error('Upload exceeds declared byte count.');
    u.fragments.push(raw);u.received+=raw.length;
    u.expires=Date.now()+TTL_MS;
    return {uploadId:args.uploadId,receivedBytes:u.received,totalBytes:u.bytes,
      status:'staging'};
  }
  finish(args){
    const u=this.#get(args?.uploadId);
    if(u.status!=='staging')throw Error('Upload already finalized.');
    if(u.received!==u.bytes)throw Error('Upload is incomplete.');
    const digest=createHash('sha256');
    for(const chunk of u.fragments)digest.update(chunk);
    const actual=Buffer.from(digest.digest('hex'),'hex'),expected=Buffer.from(u.expected,'hex');
    if(!timingSafeEqual(actual,expected)){this.delete(args.uploadId);throw Error('ZIP SHA-256 mismatch; upload discarded.');}
    u.status='ready';u.digest=u.expected;
    return {uploadId:args.uploadId,status:'ready',size:u.received,sha256:u.digest,
      expiresInSeconds:Math.max(0,Math.floor((u.expires-Date.now())/1000))};
  }
  take(args){
    const u=this.#get(args?.uploadId);
    if(u.status!=='ready')throw Error('Upload not finalized.');
    const content=Buffer.concat(u.fragments,u.received);
    this.delete(args.uploadId);
    return {content,sha256:u.digest,filename:u.filename};
  }
  delete(uploadId){
    const u=this.#uploads.get(uploadId);
    if(u){
      for(const part of u.fragments)part.fill(0);
      u.fragments.length=0;
      this.#total-=u.bytes;this.#uploads.delete(uploadId);
      return {deleted:true};
    }
    return {deleted:false};
  }
  status(uploadId){
    const u=this.#get(uploadId);
    return {uploadId,status:u.status,receivedBytes:u.received,totalBytes:u.bytes,
      expiresInSeconds:Math.max(0,Math.floor((u.expires-Date.now())/1000))};
  }
}
