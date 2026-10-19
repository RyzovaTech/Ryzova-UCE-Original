#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const baseline=JSON.parse(fs.readFileSync(process.argv[2]??'benchmark-baseline/RESULTS-1000.json','utf8'));
const rerun=JSON.parse(fs.readFileSync(process.argv[3]??'benchmark-output/RESULTS-1000.json','utf8'));
const out=path.resolve(process.argv[4]??'benchmark-output/PAIRED-COMPARISON.md');
const prev=new Map((baseline.results??[]).map(x=>[x.repo,x]));
const current=rerun.results??[];
if(prev.size!==1000||current.length!==1000||new Set(current.map(x=>x.repo)).size!==1000)throw Error('Reference and rerun must both enumerate 1000 distinct exact repo names');
const paired=current.filter(x=>prev.get(x.repo)?.status==='scanned');
const failures=paired.filter(x=>x.status!=='scanned' || x.sourceCommit!==prev.get(x.repo).sourceCommit);
function metric(field) {
  let n=0,before=0,after=0,improved=0,regressed=0,stable=0,notComparable=0;
  for(const row of paired){
    const old=prev.get(row.repo);
    if(row.status!=='scanned'||row.sourceCommit!==old.sourceCommit)continue;
    if(!old[field]||!row[field]||old[field].expected!==row[field].expected){notComparable++;continue}
    n++;before+=Number(old[field].agreement);after+=Number(row[field].agreement);
    const delta=Number(row[field].agreement)-Number(old[field].agreement);
    if(delta>0)improved++;else if(delta<0)regressed++;else stable++;
  }
  return {comparable:n,beforeCorrect:before,afterCorrect:after,improved,regressed,stable,notComparable};
}
const language=metric('language'),manager=metric('manager'),framework=metric('framework');
const changes=paired.filter(row=>{const old=prev.get(row.repo);return row.status==='scanned'&&row.sourceCommit===old.sourceCommit &&
  ['language','manager','framework'].some(k=>row[k]&&old[k]&&row[k].actual!==old[k].actual)}).map(row=>{
    const old=prev.get(row.repo);
    return {repo:row.repo,sha:row.sourceCommit,changes:Object.fromEntries(['language','manager','framework'].filter(k=>row[k]&&old[k]&&row[k].actual!==old[k].actual).map(k=>[k,{expected:old[k].expected,previous:old[k].actual,current:row[k].actual}]))}
  });
const result={baselineScanned:paired.length,strictlyComparableScans:paired.length-failures.length,pinnedFailures:failures.map(x=>({repo:x.repo,error:x.error,actualSha:x.sourceCommit,expectedSha:prev.get(x.repo).sourceCommit})),unpairedOriginalFailures:current.filter(x=>prev.get(x.repo)?.status!=='scanned').map(x=>({repo:x.repo,status:x.status,error:x.error})),language,manager,framework,changedOutputRepositories:changes.length,changes,scope:'Paired observations at exactly the same repository SHAs and frozen baseline labels; agreement proxy, NOT independently adjudicated global accuracy'};
const pct=(correct,total)=>total?(100*correct/total).toFixed(2)+'%':'N/A';
const lines=[
'# UCE — 1000-project paired baseline/post-fix comparison',
'', '**Only previously successful baseline scans, exact source SHAs, frozen GitHub language labels.**',
'If scan coverage, source SHA or external labels do not match, the case is excluded from comparable rates and flagged.',
'',
'| Metric | Baseline | Post-fix | Improvements | Regressions | Comparable |',
'|---|---:|---:|---:|---:|---:|',
...[['Language',language],['Package manager',manager],['Framework',framework]].map(([k,v])=>`| ${k} | ${v.beforeCorrect}/${v.comparable} (${pct(v.beforeCorrect,v.comparable)}) | ${v.afterCorrect}/${v.comparable} (${pct(v.afterCorrect,v.comparable)}) | ${v.improved} | ${v.regressed} | ${v.comparable} |`),
'', 'Previously scanned baseline projects: '+result.baselineScanned,
'Identical-source successfully rerun projects: '+result.strictlyComparableScans,
'Pinned scan failures or SHA mismatches: '+result.pinnedFailures.length,
'Original baseline failures outside paired denominator: '+result.unpairedOriginalFailures.length,
'', '## Changed detector outputs (not automatically true/false labels)',
'', ...changes.map(o=>'- '+o.repo+' @ '+o.sha+': '+JSON.stringify(o.changes)), '',
'## Pinned rerun failures', '',
...(result.pinnedFailures.length?result.pinnedFailures.map(o=>'- '+o.repo+': '+JSON.stringify(o)):['None']),
'', '## Caveats',
'- GitHub primary-language metadata is not verified program identity; polyglot cases differ legitimately.',
'- Marker comparisons include only labeled cases; unlabeled outcomes are not true negatives.',
'- This does NOT assess actual compatibility/security findings. See separate evidence-evaluation output with provisional review labels.',
'- The single original failed project has no baseline SHA and cannot be part of the pinned paired cohort.',
];
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,lines.join('\n')+'\n');
fs.writeFileSync(out.replace(/\.md$/,'.json'),JSON.stringify(result,null,2)+'\n');
console.log('UCE_PINNED_COMPARISON='+JSON.stringify({baselineScanned:result.baselineScanned,comparable:result.strictlyComparableScans,pinnedFailures:result.pinnedFailures.length,language,manager,framework,changed:result.changedOutputRepositories}));
if(result.pinnedFailures.length>0)process.exitCode=2;
