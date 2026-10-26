/**
 * OAuth bearer JWT verification for operator-configured identity providers.
 * Resource server only: an external OAuth 2.1 AS implements PKCE, CIMD/DCR,
 * token rotation and sign-in. Fail closed unless exact issuer/audience/scope
 * and an explicitly allowlisted subject match.
 */
import { createPublicKey, verify as signatureVerify } from 'node:crypto';

const ALGS = new Set(['RS256','ES256']);
function parsePart(value){
  if(typeof value!=='string'||!value||!/^[A-Za-z0-9_-]+$/.test(value))
    throw Error('Invalid JWT encoding');
  return Buffer.from(value,'base64url');
}
export function oauthConfig(environment=process.env){
  const raw=environment.UCE_MCP_OAUTH_CONFIG;
  if(!raw)return null;
  const cfg=JSON.parse(raw);
  if(typeof cfg.issuer!=='string'||typeof cfg.jwksUri!=='string'||
     typeof cfg.audience!=='string'||typeof cfg.scope!=='string'||
     !cfg.scope.match(/^[a-z0-9._:-]{1,64}$/))throw Error('OAuth configuration is incomplete');
  for(const uri of [cfg.issuer,cfg.jwksUri,cfg.audience]){
    const u=new URL(uri);
    if(u.protocol!=='https:'||u.username||u.password||u.hash||
       (uri!==cfg.audience && u.search))throw Error('OAuth endpoints must use canonical HTTPS');
  }
  return {issuer:cfg.issuer.replace(/\/$/,''),jwksUri:cfg.jwksUri,
    audience:cfg.audience,scope:cfg.scope};
}
export function resourceMetadata(cfg) {
  return {resource:cfg.audience,authorization_servers:[cfg.issuer],
    scopes_supported:[cfg.scope],bearer_methods_supported:['header']};
}
export function verifyTokenJwt(token,cfg,jwks,now=Math.floor(Date.now()/1000)) {
  if(typeof token!=='string'||token.length>8192)throw Error('Invalid OAuth token length');
  const parts=token.split('.');
  if(parts.length!==3)throw Error('OAuth token must be a signed JWT');
  const [h,p,s]=parts;
  const header=JSON.parse(parsePart(h).toString('utf8'));
  const payload=JSON.parse(parsePart(p).toString('utf8'));
  if(!header||!payload||!ALGS.has(header.alg)||
    typeof header.kid!=='string'||header.kid.length>128)
    throw Error('OAuth JWT protected header invalid');
  if(!jwks||!Array.isArray(jwks.keys)||jwks.keys.length>32)
    throw Error('OAuth JWKS invalid');
  const candidates=jwks.keys.filter(k=>k.kid===header.kid&&
    (!k.alg||k.alg===header.alg)&&(!k.use||k.use==='sig')&&
    (!k.key_ops||k.key_ops.includes('verify'))&&
    ((header.alg==='RS256'&&k.kty==='RSA')||
     (header.alg==='ES256'&&k.kty==='EC'&&k.crv==='P-256')));
  if(candidates.length!==1)throw Error('OAuth signing key not uniquely selected');
  const publicKey=createPublicKey({key:candidates[0],format:'jwk'});
  const data=Buffer.from(h+'.'+p);
  const signed=parsePart(s);
  const ok=header.alg==='RS256'?
    signatureVerify('RSA-SHA256',data,publicKey,signed):
    signatureVerify('sha256',data,{key:publicKey,dsaEncoding:'ieee-p1363'},signed);
  if(!ok)throw Error('OAuth JWT signature invalid');
  const aud=Array.isArray(payload.aud)?payload.aud:[payload.aud];
  if(payload.iss!==cfg.issuer||!aud.includes(cfg.audience)||
     !Number.isSafeInteger(payload.exp)||payload.exp<=now||
     payload.exp>now+24*3600||!Number.isSafeInteger(payload.iat)||
     payload.iat>now+60||payload.iat>payload.exp||
     (payload.nbf!==undefined&&(!Number.isSafeInteger(payload.nbf)||payload.nbf>now+60))||
     typeof payload.sub!=='string'||payload.sub.length<1||payload.sub.length>256)
    throw Error('OAuth issuer/audience/time/subject claims invalid');
  const scopeList=typeof payload.scope==='string'?payload.scope.split(' '):
    Array.isArray(payload.scp)?payload.scp:[];
  if(!scopeList.includes(cfg.scope))throw Error('OAuth scope insufficient');
  return payload.sub;
}
let cached=null;
export async function getJwks(cfg) {
  const now=Date.now();
  if(cached?.uri===cfg.jwksUri&&cached.expires>now)return cached.keys;
  const resp=await fetch(cfg.jwksUri,{
    headers:{accept:'application/json'},redirect:'error',
    signal:AbortSignal.timeout(6000)});
  if(!resp.ok||Number(resp.headers.get('content-length')??0)>64*1024)
    throw Error('OAuth signing keys unavailable');
  const text=await resp.text();
  if(text.length>64*1024)throw Error('OAuth signing keys too large');
  const parsed=JSON.parse(text);
  if(!Array.isArray(parsed.keys)||parsed.keys.length>32)throw Error('Invalid OAuth JWKS');
  cached={uri:cfg.jwksUri,expires:now+3*60_000,keys:parsed};
  return parsed;
}
