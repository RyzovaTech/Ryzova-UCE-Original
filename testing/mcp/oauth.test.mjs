import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { oauthConfig, resourceMetadata, verifyTokenJwt } from '../../tools/mcp/oauth-verify.mjs';

const cfg=oauthConfig({UCE_MCP_OAUTH_CONFIG:JSON.stringify({
  issuer:'https://auth.uce.example',audience:'https://mcp.uce.example/mcp',
  jwksUri:'https://auth.uce.example/.well-known/jwks.json',scope:'uce.analyze',
})});
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'test-key',alg:'RS256',use:'sig'};
const jwks={keys:[jwk]};
const now=1780000000;
function token(overrides={},head={}){
  const header={alg:'RS256',kid:'test-key',typ:'JWT',...head};
  const body={iss:cfg.issuer,aud:cfg.audience,iat:now-30,exp:now+900,
    sub:'user-123',scope:'uce.analyze',...overrides};
  const first=Buffer.from(JSON.stringify(header)).toString('base64url');
  const second=Buffer.from(JSON.stringify(body)).toString('base64url');
  return first+'.'+second+'.'+
    sign('RSA-SHA256',Buffer.from(first+'.'+second),privateKey).toString('base64url');
}
test('OAuth resource metadata identifies exact canonical MCP audience and issuer',()=>{
 const resource=resourceMetadata(cfg);
 assert.equal(resource.resource,'https://mcp.uce.example/mcp');
 assert.deepEqual(resource.authorization_servers,['https://auth.uce.example']);
 assert.deepEqual(resource.scopes_supported,['uce.analyze']);
});
test('OAuth JWT validates signature, scope, issuer, audience, subject and time',()=>{
 assert.equal(verifyTokenJwt(token(),cfg,jwks,now),'user-123');
 for(const overrides of [
   {iss:'https://attacker.example'},{aud:'https://another.example/mcp'},
   {scope:'profile:read'},{exp:now-1},{iat:now+100},
   {nbf:now+200},{sub:''},
 ]){
   assert.throws(()=>verifyTokenJwt(token(overrides),cfg,jwks,now));
 }
 assert.throws(()=>verifyTokenJwt(token({}, {alg:'none'}),cfg,jwks,now));
 const valid=token(),parts=valid.split('.');
 const tampered=parts[0]+'.'+parts[1]+'.'+(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
 assert.throws(()=>verifyTokenJwt(tampered,cfg,jwks,now),
   /invalid|signing|signature|JWT/i);
 assert.throws(()=>verifyTokenJwt(token(),cfg,{keys:[]},now));
});
test('OAuth endpoint config refuses plain HTTP and missing resource scope',()=>{
 assert.throws(()=>oauthConfig({UCE_MCP_OAUTH_CONFIG:JSON.stringify({
   issuer:'http://oauth.example',jwksUri:'https://oauth.example/jwks',
   audience:'https://mcp.example/mcp',scope:'uce.analyze'})}));
 assert.throws(()=>oauthConfig({UCE_MCP_OAUTH_CONFIG:JSON.stringify({
   issuer:'https://oauth.example',jwksUri:'https://oauth.example/jwks',
   audience:'https://mcp.example/mcp',scope:''})}));
});
