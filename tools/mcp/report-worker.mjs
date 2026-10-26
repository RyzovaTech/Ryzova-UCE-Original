#!/usr/bin/env node
/** Trusted subprocess: turns a saved UCE JSON report into bounded MCP output. */
import fs from 'node:fs';
import { load } from '../../scripts/trusted-module-loader.mjs';
const [filename,maxString]=process.argv.slice(2);
const max=Number(maxString);
if(!filename || !Number.isInteger(max)||max<1||max>30)process.exit(2);
const stat=fs.statSync(filename);
if(stat.size>8*1024*1024)process.exit(2);
const report=JSON.parse(fs.readFileSync(filename,'utf8'));
if(!report||typeof report!=='object'||!Array.isArray(report.issues) ||
  !report.score || !Number.isFinite(report.score.overall) || !report.stack ||
  !report.summary)process.exit(2);
const {buildUnifiedBrowserReport}=load('src/lib/report/unified-intelligence.ts');
const {evaluateBrowserQuality}=load('src/lib/report/phase5-quality.ts');
const snapshot=JSON.stringify(report);
const view=buildUnifiedBrowserReport(report);
const quality=evaluateBrowserQuality(report,view);
if(JSON.stringify(report)!==snapshot)throw Error('UCE report mutated by inspection');
if(quality.scoreParity!=='preserved'||quality.originalIssueParity!=='preserved')
  throw Error('Original UCE score or issue parity changed');
const truncate=(s,n=180)=>typeof s==='string'?s.slice(0,n):'';
const result={
  engine:'UCE',nativeTrilogyExecuted:false,verification:'not-run',
  score:report.score.overall,originalIssueCount:report.issues.length,
  shownIssueCount:Math.min(max,report.issues.length),
  originalIssues:report.issues.slice(0,max).map(i=>({
    id:truncate(i.id,120),title:truncate(i.title),severity:i.severity,
    affectedFile:truncate(i.affectedFile,200)
  })),
  unified:{findings:view.findings.length,rootGroups:view.rootGroups.slice(0,16).map(g=>({
    id:truncate(g.id,120),title:truncate(g.title),findings:g.findingIds.length,
    disclaimer:truncate(g.disclaimer)
  })),omittedRootGroups:Math.max(0,view.rootGroups.length-16)},
  quality:{status:quality.status,scoreParity:quality.scoreParity,
    issueParity:quality.originalIssueParity,coverage:quality.graphCoverage,
    flags:quality.flags.slice(0,20).map(f=>f.code),
    falsePositiveRate:null,falseMergeRate:null,recommendationCorrectness:null,
    humanAccuracy:'not-measured'},
  symbolic:{status:quality.symbolic.localStatus,conflict:quality.symbolic.conflict,
    satisfiable:quality.symbolic.satisfiable,unknown:quality.symbolic.unknown,
    nativeSolverStatus:'not-run-in-this-tool'},
  limitations:['Original UCE scanner remains canonical; this output does not rescore it.',
    'Root Cause clusters are review associations, not proven causal relationships.',
    'No code execution or independent SMT verification of the analyzed project.',
    'Accuracy rates require independently adjudicated real-repository evidence.']
};
process.stdout.write(JSON.stringify(result));
