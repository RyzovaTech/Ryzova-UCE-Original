import { readFile } from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('./fixtures/conflict.json',import.meta.url),'utf8'));
const mode=process.argv[2];
let output;
if(mode==='legacy') {
  const {evaluateDatalogZ3Cvc5}=await import('./triple.mjs');
  output=await evaluateDatalogZ3Cvc5(data.files);
} else if(mode==='sequential' || mode==='sequential-heap128') {
  const {evaluateSmartSequential}=await import('./smart-sequential.mjs');
  output=await evaluateSmartSequential(data.files,
    mode === 'sequential-heap128' ? { z3HeapLimitMiB: 128 } : {});
} else {
  throw Error('unknown-benchmark-mode');
}
process.stdout.write(JSON.stringify({
  status:output.status, verification:output.verification,
  stages:output.stages??null,
  stageTrace:Array.isArray(output.stageTrace)?output.stageTrace:[],
})+'\n');
