#!/usr/bin/env node
/**
 * Prepare a privacy-minimized blind review packet and aggregate intake report.
 * Do NOT run with real submissions in public CI or commit reviewer records.
 */
import fs from 'node:fs';
import path from 'node:path';
import {prepareBlindedCasePacket} from './packet.mjs';
import {auditVolunteerReviewIntake} from './intake.mjs';
const args=new Map();
for(const arg of process.argv.slice(2)){
 const m=/^--(manifest|claims|reviews|output)=(.+)$/.exec(arg);
 if(!m||args.has(m[1]))throw Error('Phase3 invalid/duplicate CLI argument');
 args.set(m[1],m[2]);
}
for(const name of ['manifest','claims','output'])
 if(!args.has(name))throw Error('Phase3 requires --'+name);
function read(file){
 const stat=fs.statSync(file);
 if(!stat.isFile()||stat.size>5*1024*1024)throw Error('Phase3 input size budget exceeded');
 return JSON.parse(fs.readFileSync(file,'utf8'));
}
const packet=prepareBlindedCasePacket(read(args.get('manifest')),read(args.get('claims')));
const submissions=args.has('reviews')?read(args.get('reviews')):{
 schemaVersion:1,studyId:packet.studyId,reviews:[],adjudications:[],
};
const intake=auditVolunteerReviewIntake(packet,submissions);
const artifact={
 schemaVersion:1,phase:'Trilogy-Phase3-community-review',
 packet,intake,
 reviewerIdentitiesAuthenticatedByTool:false,
 externalIndependentGroundTruthVerified:false,
 measuredIndependentRealWorldAccuracy:null,releaseReady:false,
};
fs.writeFileSync(path.resolve(args.get('output')),JSON.stringify(artifact,null,2)+'\n',
 {flag:'wx',mode:0o600});
console.log(JSON.stringify({phase:artifact.phase,studyId:packet.studyId,
 caseUniverseCount:packet.caseUniverseCount,
 reviewerRecordsSubmitted:intake.receivedPrimaryReviewRecords,
 status:intake.status,certifiedAccuracy:null,releaseReady:false}));
