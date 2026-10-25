import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load } from '../../scripts/trusted-module-loader.mjs';
import handler, { getPublicMetadataTarget, normalizePublicMetadata } from '../../api/repository/metadata.js';

const { parseRepositoryUrl, parseGitHubRepositoryUrl, getRepositoryArchiveUrl,
  getGitHubArchiveUrl } = load('src/lib/analyzer/repository.ts');
const { buildTrustMetadata } = load('src/lib/analyzer/trust.ts');

test('original GitHub import behavior remains unchanged', () => {
  const h=parseRepositoryUrl('https://github.com/pallets/click.git');
  assert.equal(h.provider,'github');
  assert.equal(h.owner,'pallets');
  assert.equal(h.repository,'click');
  assert.equal(h.metadataUrl,'https://api.github.com/repos/pallets/click');
  assert.equal(getRepositoryArchiveUrl(h,'main'),'/api/github/archive/pallets/click/main');
  assert.deepEqual(parseGitHubRepositoryUrl('git@github.com:pallets/click'),h);
  assert.equal(getGitHubArchiveUrl(h,'feature/issue-9'),'/api/github/archive/pallets/click/feature/issue-9');
});

test('GitLab nested group repository and Codeberg remotes use allowlisted relays',()=>{
  const gitlab=parseRepositoryUrl('https://gitlab.com/org/subgroup/sample.git');
  assert.equal(gitlab.provider,'gitlab');
  assert.deepEqual(gitlab.namespace,['org','subgroup','sample']);
  assert.equal(gitlab.metadataUrl,
    '/api/repository/metadata?provider=gitlab&path=org%2Fsubgroup%2Fsample');
  assert.equal(getRepositoryArchiveUrl(gitlab,'feature/one',42),
    '/api/gitlab/archive/42?sha=feature%2Fone');
  assert.throws(()=>getRepositoryArchiveUrl(gitlab,'main'));
  const codeberg=parseRepositoryUrl('git@codeberg.org:example/example.git');
  assert.equal(codeberg.provider,'codeberg');
  assert.equal(codeberg.repository,'example');
  assert.equal(codeberg.metadataUrl,
    '/api/repository/metadata?provider=codeberg&path=example%2Fexample');
  assert.equal(getRepositoryArchiveUrl(codeberg,'dev/next'),
    '/api/codeberg/archive/example/example/dev/next');
  assert.throws(()=>parseGitHubRepositoryUrl('https://codeberg.org/example/example'));
});

test('reject credentials, arbitrary hosts, paths and hidden protocol escapes',()=>{
  for (const url of [
    'http://github.com/pallets/click',
    'https://gitlab.com.attacker.invalid/group/repo',
    'https://localhost/owner/repo',
    'https://github.com:8443/owner/repo',
    'https://owner:secret@gitlab.com/g/repo',
    'https://gitlab.com/group/repo/-/tree/main',
    'https://codeberg.org/owner/repo?archive=1',
    'https://codeberg.org/owner/repo#token',
    'https://github.com/owner/%2e%2e',
    'https://github.com/owner//repo',
    'file:///etc/passwd',
    'https://gitlab.com/owner/repo%2Fother',
    'https://codeberg.org/owner',
    'git@evil.org:owner/repo'
  ])assert.throws(()=>parseRepositoryUrl(url),url);
  const good=parseRepositoryUrl('https://codeberg.org/owner/repo');
  for (const branch of ['../main','main?next=https://evil.invalid','main#fragment',
    '/refs/heads/main','one//two','a%2Fsecret','']) {
    assert.throws(()=>getRepositoryArchiveUrl(good,branch),branch);
  }
});

test('metadata proxy never becomes an arbitrary URL fetcher',()=>{
  assert.equal(getPublicMetadataTarget('gitlab','g/team/repo'),
    'https://gitlab.com/api/v4/projects/g%2Fteam%2Frepo');
  assert.equal(getPublicMetadataTarget('codeberg','owner/repo'),
    'https://codeberg.org/api/v1/repos/owner/repo');
  for(const [provider,name] of [
    ['github','owner/repo'],['gitlab','owner/../repo'],
    ['codeberg','owner/repo/extra'],['codeberg','https://127.0.0.1/x'],
    ['gitlab','owner/%2Frepo'],['gitlab','owner/owner?x=1'],
  ])assert.throws(()=>getPublicMetadataTarget(provider,name));
});

test('remote metadata accepts only public projects with valid default branch',()=>{
  assert.deepEqual(normalizePublicMetadata('gitlab',{
    id:104,visibility:'public',default_branch:'main'}),{default_branch:'main',id:104});
  assert.deepEqual(normalizePublicMetadata('codeberg',{
    private:false,empty:false,default_branch:'trunk'}),{default_branch:'trunk'});
  assert.throws(()=>normalizePublicMetadata('gitlab',{
    id:104,visibility:'private',default_branch:'main'}));
  assert.throws(()=>normalizePublicMetadata('gitlab',{
    id:'104',visibility:'public',default_branch:'main'}));
  assert.throws(()=>normalizePublicMetadata('codeberg',{
    private:true,default_branch:'main'}));
  assert.throws(()=>normalizePublicMetadata('codeberg',{
    private:false,empty:true,default_branch:'main'}));
});

test('provider metadata handler returns normalized JSON and denies unsupported requests',async()=>{
  const previous=globalThis.fetch;
  const makeResponse=()=>({
    statusCode:200,headers:{},setHeader(name,value){this.headers[name]=value;},
    status(value){this.statusCode=value;return this;},
    json(value){this.body=value;return this;}
  });
  try{
    const res=makeResponse();
    globalThis.fetch=async(url,options)=>{
      assert.equal(url,'https://gitlab.com/api/v4/projects/g%2Frepo');
      assert.equal(options.redirect,'error');
      return new Response(JSON.stringify({id:38,visibility:'public',
        default_branch:'main',secret:'must-not-leak'}),{status:200,
        headers:{'content-type':'application/json'}});
    };
    await handler({method:'GET',query:{provider:'gitlab',path:'g/repo'}},res);
    assert.equal(res.statusCode,200);
    assert.deepEqual(res.body,{default_branch:'main',id:38});
    assert.equal(res.headers['Cache-Control'],'private, no-store');
    const invalid=makeResponse();
    await handler({method:'GET',query:{provider:'gitlab',path:'../../etc/passwd'}},invalid);
    assert.equal(invalid.statusCode,400);
    const method=makeResponse();
    await handler({method:'POST',query:{provider:'codeberg',path:'a/b'}},method);
    assert.equal(method.statusCode,405);
  }finally{globalThis.fetch=previous;}
});

test('report source and trust metadata preserve GitLab/Codeberg provenance',()=>{
  for(const p of ['github','gitlab','codeberg']){
    const t=buildTrustMetadata(p);
    assert.equal(t.networkAccessUsed,true);
    assert.equal(t.localOnly,false);
    assert.equal(t.sourceUploaded,false);
  }
  assert.equal(buildTrustMetadata('upload').networkAccessUsed,false);
});

test('Vercel archive relays are explicit fixed upstreams',()=>{
  const v=JSON.parse(fs.readFileSync(new URL('../../vercel.json',import.meta.url),'utf8'));
  const get=source=>v.rewrites.find(r=>r.source===source)?.destination;
  assert.equal(get('/api/gitlab/archive/:id(\\d+)'),
    'https://gitlab.com/api/v4/projects/:id/repository/archive.zip');
  assert.equal(get('/api/codeberg/archive/:owner/:repository/:branch*'),
    'https://codeberg.org/:owner/:repository/archive/:branch*.zip');
  assert.equal(get('/api/github/archive/:owner/:repository/:branch*'),
    'https://codeload.github.com/:owner/:repository/zip/refs/heads/:branch*');
});
