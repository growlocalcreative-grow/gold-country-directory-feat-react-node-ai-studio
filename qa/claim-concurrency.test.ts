/** Independent focused acceptance for claim transaction guards, including real PG. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { getConfig } from '../server/config.js';
import { openDatabase, migrate, insertId, now } from '../server/db.js';
import { createApp } from '../server/app.js';
import { hashPassword } from '../server/auth.js';

test('claim approval concurrency preserves ownership and single-review atomicity',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'gcd-react-node-qa-claims-'));
  let databaseUrl='';
  if(process.env.QA_DB_ENV){databaseUrl=(await fs.readFile(process.env.QA_DB_ENV,'utf8')).match(/^DATABASE_URL=(.+)$/m)?.[1]||'';const u=new URL(databaseUrl);assert.equal(u.hostname,'127.0.0.1');assert.match(u.pathname,/^\/gcd_qa_race_[a-z0-9]+$/);}
  const config=getConfig({databaseUrl,sqlitePath:path.join(dir,'claims.sqlite'),mediaRoot:path.join(dir,'media'),emailRoot:path.join(dir,'mail'),origin:'http://127.0.0.1:38001',sessionSecret:randomBytes(48).toString('base64url'),secureCookies:false,production:false,smtpUrl:''});
  const db=openDatabase(config);await migrate(db);const app=createApp(db,config);const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const password=randomBytes(24).toString('base64url')+'aA!5',hash=await hashPassword(password);
  const users=[];for(let i=0;i<4;i++)users.push(await insertId(db,'users',{email:`claims-${i}@example.test`,password_hash:hash,is_staff:i>=2,created_at:now()}));
  const admins=[];for(let i=2;i<4;i++){const a=request.agent(server),s=(await a.get('/api/session')).body;const login=await a.post('/api/auth/login').set('Origin',config.origin).set('X-CSRF-Token',s.csrfToken).send({email:`claims-${i}@example.test`,password});assert.equal(login.status,200);admins.push({agent:a,csrf:login.body.csrfToken});}
  const categoryId=await insertId(db,'categories',{source_id:'qa-concurrency-category',slug:'qa-concurrency-category',name:'QA concurrency'});
  const makeBusiness=async(label:string)=>insertId(db,'businesses',{source_id:'qa-'+label,slug:'qa-'+label,name:'QA '+label,category_id:categoryId,status:'approved',created_at:now(),updated_at:now()});
  const makeClaim=async(business_id:number,user_id:number)=>insertId(db,'claims',{business_id,user_id,evidence:'Independent isolated QA fixture',created_at:now()});
  const moderate=(i:number,id:number,status:string)=>admins[i].agent.post(`/api/admin/claims/${id}/moderate`).set('Origin',config.origin).set('X-CSRF-Token',admins[i].csrf).send({status,ownership_verified:true});
  try{
    await t.test('simultaneous approve/reject of one claim commits exactly once',async()=>{const b=await makeBusiness('same-claim'),claim=await makeClaim(b,users[0]);const results=await Promise.all([moderate(0,claim,'approved'),moderate(1,claim,'rejected')]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const row=await db('claims').where({id:claim}).first(),business=await db('businesses').where({id:b}).first();assert.equal(business.owner_id,row.status==='approved'?users[0]:null);assert.equal((await db('audit_events').where({kind:'claims',record_id:claim})).length,1);});
    await t.test('different claimants cannot both gain the same listing',async()=>{const b=await makeBusiness('competing-claims'),a=await makeClaim(b,users[0]),c=await makeClaim(b,users[1]);const results=await Promise.all([moderate(0,a,'approved'),moderate(1,c,'approved')]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const claims=await db('claims').where({business_id:b}),business=await db('businesses').where({id:b}).first();assert.equal(claims.filter(c=>c.status==='approved').length,1);assert.equal(business.owner_id,claims.find(c=>c.status==='approved').user_id);assert.equal(claims.filter(c=>c.status==='pending').length,1);});
  }finally{server.close();await once(server,'close');await db.destroy();}
});
