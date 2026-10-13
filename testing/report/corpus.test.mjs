import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../../scripts/trusted-module-loader.mjs';
const file=(path,content='')=>({path,content,size:content.length,isDirectory:false});
const ctx=(files,stack={})=>({files,detectedFiles:files,stack:{language:'TypeScript',...stack}});
const run=(module,id,c)=>Object.values(load('src/lib/compatibility/rules/'+module+'.ts')).find(Array.isArray).find(r=>r.id===id).run(c);
test('declarations and fixture TypeScript do not require tsconfig',()=>{
 for(const p of ['index.d.ts','index.d.mts','test/fixture/main.ts'])assert.equal(run('configuration','tsconfig-present',ctx([file(p)])).length,0);
 assert.equal(run('configuration','tsconfig-present',ctx([file('src/main.ts')])).length,1);
});
test('root manifests and workspace evidence respect scope',()=>{
 for(const p of ['pom.xml','Gemfile','Library.csproj','CMakeLists.txt'])assert.equal(run('extended-structure','config-file-at-root',ctx([file(p)])).length,0);
 assert.equal(run('extended-structure','config-file-at-root',ctx([file('test/pom.xml')])).length,1);
 const files=[file('package.json','{}'),file('examples/package.json','{}')];assert.equal(run('extended-structure','multiple-package-json',ctx(files)).length,0);
 files[1]=file('packages/core/package.json','{}');assert.equal(run('extended-structure','multiple-package-json',ctx(files)).length,1);
 assert.equal(run('extended-structure','multiple-package-json',ctx([...files,file('pnpm-workspace.yaml','packages:\n - packages/*')])).length,0);
});
test('vendor, fixture and ecosystem test directories are scoped',()=>{
 const {classifyProjectFileScope:c}=load('src/lib/analyzer/project-scope.ts');
 for(const [p,s] of [['pip/_vendor/a.py','vendor'],['_fixture/a.html','fixture'],['src/jvmTest/Test.kt','test'],['src/X.Tests/Test.cs','test'],['src/testFixtures/A.java','fixture'],['a/test_files/a.js','test'],['src/jvmMain/App.kt','production']])assert.equal(c(p),s);
});
test('Go dependency-free modules do not require go.sum',()=>{
 for(const [source,count] of [['module x\ngo 1.20',0],['module x\n// require fake v1.0',0],['module x\nrequire example.com/a v1.0.0',1]])assert.equal(run('extended-dependencies','go-sum-present',ctx([file('go.mod',source)],{packageManager:'go-modules'})).length,count);
});
test('auxiliary bundler configs are excluded, real configs remain reviewable',()=>{
 for(const [p,count] of [['test/webpack.config.js',0],['webpack.config.js',1]])assert.equal(run('performance','no-minification-config',ctx([file(p,'module.exports = {}')],{buildTool:'Webpack'})).length,count);
});
test('BSD contributor clause is a third clause',()=>{
 const base='Redistribution and use in source and binary forms\nRedistributions of source code\nRedistributions in binary form';const third='The names of any contributors may not be used to endorse or promote products derived from this software.';
 const check=(license,text)=>run('license','package-json-license-vs-file',ctx([file('package.json',JSON.stringify({license})),file('LICENSE.md',text)]));assert.equal(check('BSD-3-Clause',base+third).length,0);assert.equal(check('BSD-2-Clause',base+third).length,1);assert.equal(check('BSD-2-Clause',base).length,0);
});
test('text metadata policy retains ecosystem configs',()=>{
 const {isLikelyText}=load('src/lib/analyzer/zip.ts');for(const p of ['App.csproj','Directory.Build.props','.nvmrc','Gemfile','README.rdoc'])assert.equal(isLikelyText(p),true);assert.equal(isLikelyText('picture.png'),false);
});
test('root gitignore wins and Gradle conventions contribute targets',()=>{
 const files=[file('test/.gitignore','*.tmp'),file('.gitignore','node_modules/\ndist')];assert.equal(run('extended-structure','gitignore-covers-node-modules',ctx(files,{packageManager:'npm'})).length,0);assert.equal(run('extended-structure','gitignore-covers-build-output',ctx(files,{buildTool:'Vite'})).length,0);
 const gradle=[file('build.gradle.kts','plugins {}')];assert.equal(run('extended-runtime','java-version-pinned',ctx(gradle,{runtime:'JVM'})).length,1);gradle.push(file('buildSrc/src/main/kotlin/convention.gradle.kts','sourceCompatibility = JavaVersion.VERSION_17'));assert.equal(run('extended-runtime','java-version-pinned',ctx(gradle,{runtime:'JVM'})).length,0);
});
