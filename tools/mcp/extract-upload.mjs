#!/usr/bin/env node
/**
 * Trusted ZIP/text extractor. ZIP contents never execute; strict budgets.
 * Usage: node extract-upload.mjs zip|files inputPath outputDirectory
 */
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const [mode,input,dest]=process.argv.slice(2);
if(!['zip','files'].includes(mode) || !path.isAbsolute(input||'') ||
   !path.isAbsolute(dest||'') || !fs.statSync(dest).isDirectory())process.exit(2);
const MAX_FILE=1024*1024, MAX_TOTAL=16*1024*1024, MAX_COUNT=1000;
const accepted=/\.(?:ts|tsx|js|jsx|mjs|cjs|json|jsonc|toml|yaml|yml|py|go|rs|java|kt|kts|swift|php|rb|c|cc|cpp|h|hpp|cs|html|css|scss|md|mdx|txt|xml|gradle|lock|mod|sum|exs|ex|sh|sql|graphql|vue|svelte|astro|properties|ini|conf)$/i;
const special=new Set(['Dockerfile','Makefile','Gemfile','Pipfile','.nvmrc','.node-version',
  'package-lock.json','yarn.lock','pnpm-lock.yaml','requirements.txt','.env.example']);
const sensitive=/(^|\/)(?:\.env(?:\..*)?|\.npmrc|\.pypirc|\.git|\.ssh|\.aws|\.azure|\.config|id_rsa|id_ed25519|[^/]*\.(?:pem|key|p12|pfx|kdbx))($|\/)/i;
const ignoreDir=/(^|\/)(?:node_modules|vendor|dist|build|coverage|\.next|\.nuxt|\.venv|target)($|\/)/i;
const seen=new Set();let total=0,examined=0,skipped=0,written=0;
function safeName(name){
 if(typeof name!=='string'||name.length>240||name.length===0||
   name.includes('\\')||name.includes('\0')||name.startsWith('/')||
   /^[A-Za-z]:/.test(name)||name.split('/').some(x=>!x||x==='.'||x==='..'))
   throw Error('unsafe archive source path');
 return name;
}
function consider(name,data) {
 ++examined;
 if(examined>MAX_COUNT)throw Error('too many ZIP members');
 name=safeName(name);
 const key=name.toLowerCase();
 if(seen.has(key))throw Error('duplicate case-folded filename');
 seen.add(key);
 if(sensitive.test(name)||ignoreDir.test(name)||(!accepted.test(name)&&
     !special.has(path.posix.basename(name)))){++skipped;return;}
 if(data.length>MAX_FILE||total+data.length>MAX_TOTAL)
   throw Error('uncompressed source budget exceeded');
 if(data.includes(0)){++skipped;return;}
 const full=path.join(dest,...name.split('/'));
 if(!full.startsWith(dest+path.sep))throw Error('source path escaped temporary directory');
 fs.mkdirSync(path.dirname(full),{recursive:true});
 fs.writeFileSync(full,data,{flag:'wx',mode:0o600});
 total+=data.length;written++;
}
if(mode==='zip'){
 const zipBytes=fs.readFileSync(input);
 if(zipBytes.length>4*1024*1024||zipBytes.length<4||
   zipBytes.readUInt32LE(0)!==0x04034b50)throw Error('bad ZIP signature or compressed limit');
 const zip=await JSZip.loadAsync(zipBytes,{checkCRC32:true,createFolders:false});
 const items=Object.entries(zip.files);
 if(items.length>MAX_COUNT)throw Error('archive member count exceeded');
 for(const [name,entry] of items){
   const original=entry.unsafeOriginalName??name;
   if(original!==name)throw Error('archive path normalization rejected');
   if(entry.dir){safeName(name.replace(/\/$/,''));continue;}
   const perms=typeof entry.unixPermissions==='number'?entry.unixPermissions:0;
   if((perms&0xf000)===0xa000)throw Error('archive symlinks are refused');
   const estimated=entry._data?.uncompressedSize;
   const compressed=entry._data?.compressedSize;
   if(typeof estimated!=='number'||estimated<0||estimated>MAX_FILE)
      throw Error('declared file exceeds decompression budget');
   if(typeof compressed!=='number'||compressed<0||
      (estimated>1024 && estimated/Math.max(compressed,1)>350))
      throw Error('ZIP expansion ratio exceeds limit');
   const data=await entry.async('nodebuffer');
   if(data.length!==estimated)throw Error('ZIP decompressed byte count mismatch');
   consider(name,data);
 }
}else{
 const st=fs.statSync(input);
 if(st.size>512*1024)throw Error('inline text bundle too large');
 const files=JSON.parse(fs.readFileSync(input,'utf8'));
 if(!Array.isArray(files)||files.length>32||!files.length)
    throw Error('invalid inline file bundle');
 for(const item of files){
   if(!item||typeof item.path!=='string'||typeof item.content!=='string')
     throw Error('invalid inline source file');
   consider(item.path,Buffer.from(item.content,'utf8'));
 }
}
if(!written)throw Error('no supported non-sensitive text source was provided');
process.stdout.write(JSON.stringify({files:written,skipped,contentBytes:total,
  scope:'uploaded-text-source-only; unsupported and sensitive files excluded'}));
