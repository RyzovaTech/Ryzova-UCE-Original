#!/usr/bin/env node
/** Local, bounded T7 source-provenance audit. Never retrieves or executes code. */
import fs from 'node:fs';
import path from 'node:path';
import {verifyT7SourceSnapshots} from './source-provenance.mjs';
const args=new Map();
for(const arg of process.argv.slice(2)){
 const match=/^--(manifest|registry|output)=(.+)$/.exec(arg);
 if(!match||args.has(match[1]))throw Error('T7 source audit invalid/duplicate CLI argument');
 args.set(match[1],match[2]);
}
if(!args.has('manifest')||!args.has('registry'))
 throw Error('T7 source audit requires --manifest and --registry');
function read(file){
 const size=fs.statSync(file).size;
 if(size>5*1024*1024)throw Error('T7 provenance input file budget exceeded');
 return JSON.parse(fs.readFileSync(file,'utf8'));
}
const artifact=verifyT7SourceSnapshots(read(args.get('manifest')),read(args.get('registry')));
if(args.has('output')){
 const target=path.resolve(args.get('output'));
 fs.writeFileSync(target,JSON.stringify(artifact,null,2)+'\n',{flag:'wx',mode:0o600});
}
console.log(JSON.stringify(artifact,null,2));
