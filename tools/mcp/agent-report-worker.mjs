#!/usr/bin/env node
/**
 * Pageable full rule and compatibility evidence from a canonical UCE report.
 * Project code is never loaded; only UCE trusted source modules are loaded.
 */
import fs from 'node:fs';
import { load } from '../../scripts/trusted-module-loader.mjs';
const [filename,mode,offsetArg,limitArg]=process.argv.slice(2);
const offset=Number(offsetArg??0),limit=Number(limitArg??25);
if(!filename||!['summary','findings','rules'].includes(mode)||
   !Number.isSafeInteger(offset)||offset<0||
   !Number.isSafeInteger(limit)||limit<1||limit>100)process.exit(2);
const st=fs.statSync(filename);
const maxReport=Number(process.env.UCE_MCP_MAX_REPORT_BYTES??128*1024*1024);
if(!Number.isSafeInteger(maxReport)||maxReport<1||st.size>maxReport)process.exit(2);
const raw=fs.readFileSync(filename,'utf8');
const report=JSON.parse(raw);
if(!report||typeof report!=='object'||!Array.isArray(report.issues)||
   !report.score||!Number.isFinite(report.score.overall)||!report.stack||!report.summary)
  throw Error('Invalid canonical UCE analysis report');
const {buildUnifiedBrowserReport}=load('src/lib/report/unified-intelligence.ts');
const {evaluateBrowserQuality}=load('src/lib/report/phase5-quality.ts');
const before=JSON.stringify(report);
const view=buildUnifiedBrowserReport(report),quality=evaluateBrowserQuality(report,view);
if(before!==JSON.stringify(report)||quality.scoreParity!=='preserved'||
   quality.originalIssueParity!=='preserved')throw Error('UCE report structural parity violated');
const clean=(s,max=600)=>typeof s==='string'?s.slice(0,max):'';
const findings=[];
for(const issue of report.issues){
  findings.push({id:clean(issue.id,200),module:'compatibility',
    ruleId:clean(issue.ruleId??'compatibility.'+(issue.category??'unknown'),200),
    severity:issue.severity,title:clean(issue.title),category:issue.category??null,
    file:clean(issue.affectedFile,300)||null,evidence:clean(issue.reason??issue.description),
    recommendation:clean(issue.recommendation),source:'original-UCE-issue'});
}
for(const entry of report.stack?.v3RulePlatform?.findings??[]){
 findings.push({id:clean(entry.id??entry.ruleId,200),module:clean(entry.module,100)||'v3',
  ruleId:clean(entry.ruleId,200),severity:entry.severity,title:clean(entry.title),
  file:clean(entry.file,300)||null,line:entry.line??null,
  evidence:(entry.evidence??[]).slice(0,8).map(x=>clean(x.detail,350)),
  recommendation:clean(entry.recommendation),source:'UCE-V3-rule'});
}
for(const entry of report.stack?.securityIntelligence?.findings??[]){
 findings.push({id:clean(entry.id,200),module:'security',
  ruleId:clean(entry.ruleId??'security.unknown',200),severity:entry.severity,
  title:clean(entry.title),file:clean(entry.file,300)||null,line:entry.line??null,
  evidence:clean(entry.evidence),recommendation:clean(entry.recommendation),
  source:'UCE-security-rule'});
}
for(const module of Object.values(report.stack?.extendedIntelligence?.modules??{})){
 for(const entry of module.findings??[]){
  findings.push({id:clean(entry.id,200),module:clean(module.id,100),
   ruleId:clean(entry.ruleId??entry.id,200),severity:entry.severity,
   title:clean(entry.title),file:clean(entry.file,300)||null,
   evidence:clean(entry.evidence),recommendation:clean(entry.recommendation),
   source:'UCE-extended-rule'});
 }
}
const groups=new Map();
for(const item of findings){const key=item.module;
 const value=groups.get(key)??{module:key,findings:0,critical:0,warning:0};
 value.findings++;
 if(item.severity==='critical')value.critical++;
 if(item.severity==='warning')value.warning++;
 groups.set(key,value);}
const overall={
  resultType:'UCE-canonical-rule-evaluation',version:report.analysisVersion,
  score:report.score.overall,originalIssueCount:report.issues.length,
  evaluatedFindings:findings.length,ruleModules:[...groups.values()],
  coverage:quality.graphCoverage,structuralQuality:quality.status,
  structuralParity:{score:quality.scoreParity,issues:quality.originalIssueParity},
  classifier:{primaryLanguage:report.stack?.language?.primary??null,
    framework:report.stack?.framework??null},
  groups:view.rootGroups.slice(0,40).map(g=>({
    id:clean(g.id,120),title:clean(g.title),linkedFindings:g.findingIds.length,
    disclaimer:clean(g.disclaimer)})),
  omittedRootGroups:Math.max(0,view.rootGroups.length-40),
  nativeTrilogyExecuted:false,
  humanAccuracy:'not-measured',falsePositiveRate:null,falseMergeRate:null,
  conclusions:'Rule hits require source review; Unknown is not compatible or issue-free.'
};
const output=mode==='summary'?overall:
 mode==='rules'?{...overall,groups:undefined,ruleModules:[...groups.values()].slice(offset,offset+limit),
   offset,limit,total:[...groups.values()].length,hasMore:offset+limit<groups.size}:
 {type:'UCE-rule-evidence-page',analysisVersion:report.analysisVersion,
  total:findings.length,offset,limit,hasMore:offset+limit<findings.length,
  items:findings.slice(offset,offset+limit),
  provenance:'canonical original UCE analyzer output; no inferred exploitability'};
process.stdout.write(JSON.stringify(output));
