/** Independent local protocol mocks. Not a real Google OAuth round-trip. */
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import request from 'supertest';
import { OAuth2Client } from 'google-auth-library';
import { getConfig } from '../server/config.js';
import { openDatabase, migrate } from '../server/db.js';
import { createApp } from '../server/app.js';

test('independent Google protocol and explicit-account-link boundaries (mocked provider)', async t => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gcd-react-node-qa-oauth-'));
  const origin='http://localhost:38914';
  const config=getConfig({databaseUrl:'',sqlitePath:path.join(dir,'oauth.sqlite'),mediaRoot:path.join(dir,'media'),emailRoot:path.join(dir,'mail'),origin,sessionSecret:randomBytes(48).toString('base64url'),production:false,secureCookies:false,googleClientId:'qa-client.apps.googleusercontent.com',googleClientSecret:'test-only-not-real',smtpUrl:''});
  const db=openDatabase(config);await migrate(db);const app=createApp(db,config);
  const originalToken=OAuth2Client.prototype.getToken,originalVerify=OAuth2Client.prototype.verifyIdToken;
  let exchanges=0,identity:any={},expectedChallenge='',verifiedAudience='';
  (OAuth2Client.prototype as any).getToken=async(options:any)=>{exchanges++;assert.equal(createHash('sha256').update(options.codeVerifier).digest('base64url'),expectedChallenge);return{tokens:{id_token:'mock-provider-token'}};};
  (OAuth2Client.prototype as any).verifyIdToken=async(options:any)=>{verifiedAudience=options.audience;return{getPayload:()=>identity};};
  const password=randomBytes(24).toString('base64url')+'aA!5';
  const localEmail='existing-local@example.test';
  const local=request.agent(app),google=request.agent(app);
  const session=async(agent:any)=>(await agent.get('/api/session')).body;
  const post=async(agent:any,url:string,data:any)=>{const s=await session(agent);return agent.post(url).set('Origin',origin).set('X-CSRF-Token',s.csrfToken).send(data);};
  const start=async(agent:any,link=false)=>{const r=await post(agent,'/api/auth/google/start',{link});assert.equal(r.status,200);const url=new URL(r.body.url);expectedChallenge=url.searchParams.get('code_challenge')!;return url;};
  const callback=(agent:any,url:URL,state?:string)=>agent.get('/api/auth/google/callback').query({state:state||url.searchParams.get('state'),code:'mock-code'});
  try {
    await t.test('create ordinary local fixture without default admins',async()=>{const r=await post(local,'/api/auth/signup',{email:localEmail,password});assert.equal(r.status,201);assert.equal(r.body.user.is_staff,false);assert.equal((await db('users').where({is_staff:true})).length,0);});
    await t.test('wrong state stops before any token exchange',async()=>{const url=await start(google);const before=exchanges;assert.equal((await callback(google,url,'forged-state')).status,400);assert.equal(exchanges,before);assert.equal((await session(google)).user,null);});
    await t.test('verified matching email never silently takes over local password account',async()=>{const url=await start(google);identity={sub:'google-sub-local-email',email:localEmail,email_verified:true,nonce:url.searchParams.get('nonce')};const r=await callback(google,url);assert.equal(r.status,409);assert.equal(r.body.error.code,'account_link_required');assert.equal((await session(google)).user,null);assert.equal((await db('oauth_accounts')).length,0);assert.equal(verifiedAudience,config.googleClientId);});
    await t.test('nonce mismatch refuses identity even after token verification',async()=>{const url=await start(google);identity={sub:'wrong-nonce',email:'nonce@example.test',email_verified:true,nonce:'forged-nonce'};assert.equal((await callback(google,url)).status,400);assert.equal((await db('users').where({email:'nonce@example.test'})).length,0);assert.equal((await session(google)).user,null);});
    await t.test('unverified provider email cannot create account',async()=>{const url=await start(google);identity={sub:'unverified',email:'unverified@example.test',email_verified:false,nonce:url.searchParams.get('nonce')};assert.equal((await callback(google,url)).status,400);assert.equal((await db('users').where({email:'unverified@example.test'})).length,0);});
    await t.test('explicit authenticated linking succeeds and callback state is single-use',async()=>{const url=await start(local,true);identity={sub:'google-sub-local-email',email:localEmail,email_verified:true,nonce:url.searchParams.get('nonce')};assert.equal((await callback(local,url)).status,302);assert.equal((await db('oauth_accounts')).length,1);assert.equal((await session(local)).user.email,localEmail);const before=exchanges;assert.equal((await callback(local,url)).status,400);assert.equal(exchanges,before);});
    await t.test('only previously linked subject can authenticate matching local user',async()=>{const url=await start(google);identity={sub:'google-sub-local-email',email:localEmail,email_verified:true,nonce:url.searchParams.get('nonce')};assert.equal((await callback(google,url)).status,302);assert.equal((await session(google)).user.email,localEmail);assert.equal((await db('users')).length,1);});
  } finally {OAuth2Client.prototype.getToken=originalToken;OAuth2Client.prototype.verifyIdToken=originalVerify;await db.destroy();}
});
