#!/usr/bin/env node
/** Offline T7 evaluation. Without real source/reviews, emits explicit HOLD. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {evaluateT7Study} from './evaluate.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const args=new Map();
for(const raw of process.argv.slice(2)){
 const m=/^--(manifest|reviews|baseline|augmented|output)=(.+)$/.exec(raw);
 if(!m||args.has(m[1]))throw Error('T7 unsupported or duplicate CLI argument');
 args.set(m[1],m[2]);
}
const keys=['manifest','reviews','baseline','augmented'];
const present=keys.filter(k=>args.has(k));
if(present.length&&present.length!==4)
 throw Error('T7 paired study requires manifest, reviews, baseline and augmented inputs');
function readJson(file){
 if(fs.statSync(file).size>5*1024*1024)throw Error('T7 input file budget exceeded');
 return JSON.parse(fs.readFileSync(file,'utf8'));
}
const empty={
 schemaVersion:1,studyId:'trilogy-t7-no-human-study-yet',
 protocolSha256:sha('Trilogy T7 blinded paired study protocol v1 with no verified human cases'),
 samplingFrameSha256:sha('NO-INDEPENDENTLY-VERIFIED-SAMPLING-FRAME-YET'),
 cases:[],
};
const manifest=present.length?readJson(args.get('manifest')):empty;
const reviews=present.length?readJson(args.get('reviews')):{
 schemaVersion:1,studyId:manifest.studyId,cases:[]};
const baseline=present.length?readJson(args.get('baseline')):[];
const augmented=present.length?readJson(args.get('augmented')):[];
const result=evaluateT7Study(manifest,reviews,baseline,augmented);
const artifact={...result,
 runMode:present.length?'self-submitted-study-diagnostics':'no-real-world-study-data-provided',
 existingUCEFixtureCorpusUsedAsGroundTruth:false,
 independentHumanReviewPerformedByThisScript:false,
 sourceCodeDownloadedOrExecuted:false};
if(args.has('output'))fs.writeFileSync(path.resolve(args.get('output')),JSON.stringify(artifact,null,2)+'\n');
console.log(JSON.stringify(artifact,null,2));
