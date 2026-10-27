#!/usr/bin/env node
/** Offline T7 paired evaluation. No externally authenticated human labels. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {evaluateT7Study} from './evaluate.mjs';
import {verifyT7SourceSnapshots} from './source-provenance.mjs';
import {bindT7LocalProvenance} from './study-integrity.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const args=new Map();
for(const raw of process.argv.slice(2)){
 const m=/^--(manifest|reviews|baseline|augmented|registry|output)=(.+)$/.exec(raw);
 if(!m||args.has(m[1]))throw Error('T7 unsupported or duplicate CLI argument');
 args.set(m[1],m[2]);
}
const keys=['manifest','reviews','baseline','augmented'];
const present=keys.filter(k=>args.has(k));
if(present.length&&present.length!==4)
 throw Error('T7 paired study requires manifest, reviews, baseline and augmented inputs');
if(args.has('registry')&&present.length!==4)
 throw Error('T7 source registry requires the complete frozen paired study');
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
// The same process reopens Git objects from the caller's registry; unlike a
// standalone JSON audit, this is not trusting caller-supplied 'verified' flags.
const sourceAudit=args.has('registry')?
 verifyT7SourceSnapshots(manifest,readJson(args.get('registry'))):null;
const artifact={...result,
 localSourceProvenance:bindT7LocalProvenance(manifest,sourceAudit),
 runMode:present.length?'self-submitted-study-diagnostics':'no-real-world-study-data-provided',
 existingUCEFixtureCorpusUsedAsGroundTruth:false,
 independentHumanReviewPerformedByThisScript:false,
 sourceCodeDownloadedOrExecuted:false};
if(args.has('output'))fs.writeFileSync(path.resolve(args.get('output')),
 JSON.stringify(artifact,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify(artifact,null,2));
