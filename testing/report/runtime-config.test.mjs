import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../../scripts/trusted-module-loader.mjs';
const files=entries=>Object.entries(entries).map(([path,content])=>({path,content,isDirectory:false,size:content?.length??0}));
const run=(module,id,entries,stack={})=>Object.values(load('src/lib/compatibility/rules/'+module+'.ts')).find(Array.isArray).find(r=>r.id===id).run({files:files(entries),detectedFiles:files(entries),stack});
for(const [range,expected] of [['>=16',0],['>=0.10',0],['16 || 22',0],['^16 || ^24',0],['*',0],['>=28',0],['lts/*',0],['16',1],['^20',1],['23.x',1],['25',1],['>=16 <18',1],['22',0],['24',0],['26',0],['>=16 <16',0]])test('Node engine range '+range,()=>{
 const issues=run('runtime','node-engine-pinned',{'package.json':JSON.stringify({engines:{node:range}})},{runtime:'Node.js'});assert.equal(issues.filter(i=>i.id==='node-engine-outdated').length,expected);assert.ok(issues.every(i=>i.severity!=='critical'));
});
test('Docker evidence is anchored, package-scoped and stage-specific',()=>{
 const issues=run('runtime','dockerfile-runtime-detected',{'test/Dockerfile':'FROM node:16','Dockerfile':'# FROM node:16\nRUN echo "FROM node:14"\nFROM --platform=linux/amd64 node:20-alpine AS build\nFROM node:24 AS runtime'});
 assert.equal(issues.length,1);assert.equal(issues[0].affectedFile,'Dockerfile');assert.match(issues[0].description,/:3 selects Node 20/);
});
const strict=entries=>run('extended-configuration','tsconfig-strict-mode',entries,{language:'TypeScript'});
test('JSONC inheritance resolves true, false and child overrides',()=>{
 const base={'tsconfig.json':'{"extends":"./base"}','base.json':'{/*comment*/"compilerOptions":{"strict":true,},}'};
 assert.equal(strict(base).length,0);assert.equal(strict({...base,'tsconfig.json':'{"extends":"./base","compilerOptions":{"strict":false}}'}).length,1);
 assert.equal(strict({'tsconfig.json':'{// comment\n"compilerOptions":{},}'}).length,1);
});
test('unresolved packages, cycles and unread input cannot prove missing strict',()=>{
 for(const entries of [{'tsconfig.json':'{"extends":"@tsconfig/node22/tsconfig.json"}'},{'tsconfig.json':'{"extends":"./other"}','other.json':'{"extends":"./tsconfig"}'},{'tsconfig.json':undefined}])assert.equal(strict(entries).length,0);
 assert.equal(strict({'tsconfig.json':'{"extends":"missing","compilerOptions":{"strict":false}}'}).length,1);
});
test('ordered extends, solution references and parent paths retain evidence boundaries',()=>{
 const {resolveTypeScriptOptions:resolve}=load('src/lib/analyzer/typescript-options.ts');
 const f=files({'tsconfig.json':'{"extends":["./a","./b"]}','a.json':'{"compilerOptions":{"strict":true}}','b.json':'{"compilerOptions":{"strict":false}}'});assert.equal(resolve(f,'tsconfig.json').options.strict,false);
 assert.equal(strict({'tsconfig.json':'{"files":[],"references":[{"path":"./app"}]}'}).length,0);
 assert.equal(resolve(files({'src/tsconfig.json':'{"extends":"../base"}','base.json':'{"compilerOptions":{"strict":true}}'}),'src/tsconfig.json').options.strict,true);
 assert.equal(resolve(files({'tsconfig.json':'{"extends":"../outside"}'}),'tsconfig.json').complete,false);
});
const env=entries=>run('configuration','env-example-present',entries);
test('comments, prose, builtins and Gradle embedded JS are not environment-read evidence',()=>{
 for(const [path,content] of [['src/app.js','// process.env.SECRET\nconst text = "process.env.TOKEN";'],['src/app.ts','const text: string = "process.env.TOKEN";'],['build.gradle.kts','val js = "process.env.TOKEN"'],['src/app.js','console.log(process.env.NODE_ENV, import.meta.env.MODE);']])assert.equal(env({[path]:content}).length,0);
 assert.equal(env({'src/app.js':'console.log(process.env.TOKEN)'}).length,1);
});
test('environment templates respect package boundaries and auxiliary scope',()=>{
 assert.equal(env({'src/app.js':'console.log(process.env.TOKEN)','examples/.env.example':'TOKEN='}).length,1);
 const entries={'packages/a/package.json':'{}','packages/a/app.js':'console.log(process.env.TOKEN)','packages/b/package.json':'{}','packages/b/.env.example':'TOKEN='};
 const result=env(entries);assert.equal(result.length,1);assert.equal(result[0].affectedFile,'packages/a/.env.example');
 assert.equal(env({...entries,'packages/a/.env.example':'TOKEN='}).length,0);
});
test('Kotlin literal examples do not hide real JVM environment reads',()=>{
 assert.equal(env({'src/App.kt':'val hint = "System.getenv(SECRET)"'}).length,0);
 assert.equal(env({'src/App.kt':'val secret = System.getenv("SECRET")'}).length,1);
});
test('pinned Hapi manifest lower bound is not a deployed EOL runtime',async()=>{
 const {readFileSync}=await import('node:fs');const evidence=JSON.parse(readFileSync(new URL('../benchmark/hapi-engine.json',import.meta.url),'utf8'));
 assert.match(evidence.commit,/^[a-f0-9]{40}$/);
 assert.equal(run('runtime','node-engine-pinned',{'package.json':JSON.stringify(evidence.excerpt)},{runtime:'Node.js'}).some(i=>i.id===evidence.expectedFinding),evidence.expected);
 const mutant={...evidence.excerpt,engines:{node:'^14.15.0'}};
 assert.equal(run('runtime','node-engine-pinned',{'package.json':JSON.stringify(mutant)},{runtime:'Node.js'}).some(i=>i.id===evidence.expectedFinding),true);
});
test('actual EOL version pins remain visible even when the engine range permits modern Node',()=>{
 const entries={'package.json':'{"engines":{"node":">=16"}}','.nvmrc':'v16.20.2 # selected runtime','packages/modern/.node-version':'24','examples/.nvmrc':'14'};
 const issues=run('runtime','node-selected-runtime-eol',entries);
 assert.equal(issues.length,1);assert.equal(issues[0].affectedFile,'.nvmrc');
 for(const value of ['lts/*','node','>=16','22','24','26','28','1','3','16\n24'])assert.equal(run('runtime','node-selected-runtime-eol',{'.node-version':value}).length,0);
});
