#!/usr/bin/env python3
"""Pinned before/after scans; scanned repository code is never executed."""
import concurrent.futures,json,os,pathlib,subprocess,sys,time
root=pathlib.Path(sys.argv[1]).resolve();root.mkdir(parents=True,exist_ok=True)
base=pathlib.Path(sys.argv[2]).resolve();current=pathlib.Path(__file__).resolve().parents[2]
selection=json.loads(pathlib.Path(__file__).with_name('selection.json').read_text())
assert len(selection)==len(set(x.lower() for x in selection))==100

def findings(j):
 out={'compat:'+x['id']+':'+str(x.get('affectedFile','')) for x in j['issues']}
 for name,m in j['stack'].get('extendedIntelligence',{}).get('modules',{}).items():
  out.update('extended:'+name+':'+x['id']+':'+str(x.get('file','')) for x in m['findings'])
 return out

def run(repo):
 start=time.monotonic();name=repo.replace('/','__');dest=root/name;result={'repository':repo}
 try:
  if not (dest/'.git').exists():
   subprocess.run(['git','clone','--depth=1','--quiet','https://github.com/'+repo+'.git',str(dest)],check=True,capture_output=True,timeout=240,env={**os.environ,'GIT_TERMINAL_PROMPT':'0'})
  result['commit']=subprocess.check_output(['git','-C',str(dest),'rev-parse','HEAD'],text=True).strip()
  reports=[]
  for label,engine in [('before',base),('after',current)]:
   path=root/(name+'-'+label+'.json')
   subprocess.run(['node',str(engine/'scripts/uce-scan.mjs'),str(dest),'--output='+str(path)],check=True,capture_output=True,text=True,timeout=240)
   reports.append(json.loads(path.read_text()))
  b,a=reports;bf,af=findings(b),findings(a)
  result.update(status='ok',before=len(bf),after=len(af),removed=sorted(bf-af),added=sorted(af-bf),language=a['stack'].get('primaryLanguage'),beforeCoverage=b['summary']['scanStats'],afterCoverage=a['summary']['scanStats'])
 except Exception as e:result.update(status='error',error=str(e),detail=str(getattr(e,'stderr',''))[-1200:])
 result['seconds']=round(time.monotonic()-start,2)
 (root/(name+'-run.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['beforeCoverage','afterCoverage','removed','added']}),flush=True)
 return result
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(run,selection))
ok=[r for r in results if r['status']=='ok']
summary={'repositories':len(results),'completed':len(ok),'removed':sum(len(r['removed']) for r in ok),'added':sum(len(r['added']) for r in ok),'changed':sum(bool(r['removed'] or r['added']) for r in ok),'contentLimited':sum(bool(r['afterCoverage'].get('truncated')) for r in ok),'results':results}
(root/'results.json').write_text(json.dumps(summary,indent=2)+'\n')
(root/'pinned-manifest.json').write_text(json.dumps([{'repository':r['repository'],'commit':r.get('commit')} for r in results],indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k!='results'}),flush=True)
if os.environ.get('GITHUB_STEP_SUMMARY'):
 with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as out:out.write('## 100-repository UCE scan\n\n'+json.dumps({k:v for k,v in summary.items() if k!='results'})+'\n\nCounts are deduplicated rule/file keys, not accuracy percentages. See artifacts for pins, full reports and limitations.\n')
sys.exit(0 if len(ok)==100 else 1)
