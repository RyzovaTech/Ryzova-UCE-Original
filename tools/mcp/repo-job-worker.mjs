#!/usr/bin/env node
/* Off-process bounded full UCE scan; no untrusted code/dependencies execute. */
import {scanRemoteRepository} from './repository-scan.mjs';
const [request,outputFile]=process.argv.slice(2);
if(typeof request!=='string'||request.length>1500||
   typeof outputFile!=='string'||!outputFile.includes('uce-mcp-report-'))process.exit(2);
try{
  const args=JSON.parse(request);
  if(!args || typeof args.repository!=='string')throw Error('Missing repository');
  const result=scanRemoteRepository(args,outputFile);
  process.stdout.write(JSON.stringify(result)+'\n');
}catch {
  process.stderr.write('UCE public repository scan failed within the requested resource policy.\n');
  process.exitCode=1;
}
