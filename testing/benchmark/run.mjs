import fs from 'node:fs';
import { evaluate } from './evaluate.mjs';
import { load } from '../../scripts/trusted-module-loader.mjs';
const corpus=JSON.parse(fs.readFileSync(new URL('./corpus.json',import.meta.url),'utf8'));
const report=evaluate(corpus,c=>{
  const exports=load('src/lib/compatibility/rules/'+c.module+'.ts');
  const rule=Object.values(exports).find(Array.isArray)?.find(r=>r.id===c.rule);
  if(!rule)throw Error('Unknown rule '+c.rule);
  const files=c.files.map(f=>({...f,size:Buffer.byteLength(f.content),isDirectory:false}));
  return rule.run({files,detectedFiles:files,stack:c.stack,projectName:c.id});
});
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9);
if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--check') && report.failures.length)process.exitCode=1;
if(process.argv.includes('--require-95'))process.exitCode=2; // Development data cannot authorize a release claim.
