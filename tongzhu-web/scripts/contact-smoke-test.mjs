import {resetRates,grantFixtureMember} from './member-test-fixtures.mjs';
resetRates();
// Dedicated local integration test. Withdraws all created intake records.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {globSync} from 'node:fs';
import http from 'node:http';
const databases=globSync('.wrangler/member-tests/v3/d1/miniflare-D1DatabaseObject/*.sqlite').filter(p=>!p.endsWith('/metadata.sqlite'));
assert.equal(databases.length,1,'Run against the dedicated .wrangler/member-tests database');
function localSQL(sql,args=[]){execFileSync('python',['-c','import sqlite3,sys,json; c=sqlite3.connect(sys.argv[1],timeout=15); c.execute(sys.argv[2],json.loads(sys.argv[3])); c.commit()',databases[0],sql,JSON.stringify(args)]);}
const origin=process.argv[2]||'http://127.0.0.1:5188';
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const records=[];
async function localFetch(url,options={}){
 const wire=new Request(url,options),body=options.body?Buffer.from(await wire.arrayBuffer()):undefined;
 const response=await new Promise((resolve,reject)=>{
  const req=http.request(url,{method:wire.method,headers:{...Object.fromEntries(wire.headers),...(body?{'content-length':body.length}:{})},agent:false},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));res.on('error',reject);
  });
  req.setTimeout(15000,()=>req.destroy(new Error('Local request timed out: '+url)));req.on('error',reject);req.end(body);
 });
 return response;
}
function client(){let cookie='';return async(path,method='GET',body,status=200)=>{const r=await localFetch(origin+'/api/v1/'+path,{signal:AbortSignal.timeout(15000),method,headers:{connection:'close',cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const d=await r.json();assert((Array.isArray(status)?status:[status]).includes(r.status),`${path}: expected ${status}, got ${r.status}: ${JSON.stringify(d)}`);return {data:d,headers:r.headers,status:r.status};};}
const anon=client(),viewer=client();
const registered=await viewer('auth/register','POST',{email:`contact-${crypto.randomUUID()}@test.local`,password:'Local-contact-strong-password1',firstName:'本地测试',age:26,gender:'不透露',city:'贵阳',district:'观山湖区',budgetMax:1200,bio:'',lifestyleTags:[]});
const publisher=client();const {data:pub}=await publisher('auth/register','POST',{email:crypto.randomUUID()+'@test.local',password:'Publisher1234'});grantFixtureMember(pub.id);
async function create(visibility='members',contact='auditcontact01',contactType='wechat'){
 const token=crypto.randomUUID(),sessionId=crypto.randomUUID(),f=new FormData();
 for(const [k,v]of Object.entries({receiptToken:token,sessionId,adult:'true',consent:'true'}))f.append(k,v);
 f.append('file',new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')],'test.png',{type:'image/png'}));
 const up=await localFetch(origin+'/api/v1/pilot/uploads',{method:'POST',headers:{connection:'close'},body:f,signal:AbortSignal.timeout(15000)});assert.equal(up.status,201);const photo=await up.json();
 const body={title:'测试求租自定义标题',gender:'女',sessionId,receiptToken:token,kind:'seeker',city:'贵阳',district:'观山湖区',budget:1200,moveIn:new Date(Date.now()+14*86400000).toISOString().slice(0,10),note:'本地虚构回归数据，请勿作为真实需求。',nickname:'虚构测试',contactType,contact,adult:true,consent:true,publicConsent:true,contactVisibility:visibility,source:'direct',photoIds:[photo.id]};
 const missing={...body};delete missing.contactVisibility;await publisher('pilot/leads','POST',missing,400);await publisher('pilot/leads','POST',{...body,contactVisibility:'everyone'},400);
 const {data}=await publisher('pilot/leads','POST',body,201);const row={id:data.id,token,photo:photo.id,body};records.push(row);return row;
}
try{
 const row=await create();
 await anon(`pilot/leads/${row.id}/contact`,'POST',{},401);
 let response=await viewer(`pilot/leads/${row.id}/contact`,'POST',{});assert.equal(response.data.wechat,'auditcontact01');assert.equal(response.headers.get('cache-control'),'no-store');
 console.log('PASS: anonymous disclosure denied; logged-in viewer receives explicitly authorized contact');
 for(const call of [anon,viewer]){const {data:feed}=await call('listings?city=贵阳&demo=0');assert(!JSON.stringify(feed).includes('auditcontact01'));const {data}=await call('listings/pilot-'+row.id);assert(!JSON.stringify(data).includes('auditcontact01'));assert.equal(data.contactPublic,true);}
 localSQL('UPDATE pilot_leads SET photo_ids=? WHERE id=?',['[]',row.id]);assert.equal((await localFetch(origin+'/api/v1/pilot/photos/public/'+row.photo)).status,404,'photo outside published selection must not be public');localSQL('UPDATE pilot_leads SET photo_ids=? WHERE id=?',[JSON.stringify([row.photo]),row.id]);
 const settings=`pilot/leads/${row.id}/contact-settings`;
 await anon(settings,'PUT',{receiptToken:crypto.randomUUID(),contactVisibility:'operator'},404);
 await anon(settings,'PUT',{receiptToken:row.token,contactVisibility:'operator'});
 await viewer(`pilot/leads/${row.id}/contact`,'POST',{},403);
 await anon(settings,'PUT',{receiptToken:row.token,contactVisibility:'members'});
 await viewer(`pilot/leads/${row.id}/contact`,'POST',{});
 const privateRow=await create('operator','auditprivate01');await viewer(`pilot/leads/${privateRow.id}/contact`,'POST',{},403);
 const sibling=await create('members','auditcontact01');await viewer(`pilot/leads/${sibling.id}/contact`,'POST',{});
 const others=[];for(let i=0;i<5;i++)others.push(await create('members','auditother0'+i));
 // Four new publishers plus the first = five. The duplicate-contact listing costs no extra slot.
 await Promise.all(others.slice(0,3).map(r=>viewer(`pilot/leads/${r.id}/contact`,'POST',{})));
 const race=await Promise.all(others.slice(3).map(r=>viewer(`pilot/leads/${r.id}/contact`,'POST',{},[200,429])));assert.deepEqual(race.map(r=>r.status).sort(),[200,429]);
 await viewer(`pilot/leads/${row.id}/contact`,'POST',{});
 const regular=client();const {data:owner}=await regular('auth/register','POST',{email:`owner-${crypto.randomUUID()}@test.local`,password:'Local-contact-strong-password1',firstName:'普通发布者',age:26,gender:'不透露',city:'贵阳',district:'观山湖区',budgetMax:1200,bio:'',lifestyleTags:[],contact:{wechat:'regularnew01',phone:'',visible:true}});
 localSQL('UPDATE users SET contact=? WHERE id=?',[JSON.stringify({wechat:'regularnew01',phone:'',visible:true}),owner.id]);await viewer(`users/${owner.id}/contact`,'POST',{},429);
 localSQL('UPDATE users SET contact=? WHERE id=?',[JSON.stringify({wechat:'auditcontact01',phone:'',visible:true}),owner.id]);
 assert.equal((await viewer(`users/${owner.id}/contact`,'POST',{})).data.wechat,'auditcontact01');
 console.log('PASS: regular and pilot contacts share the same daily quota');
 console.log('PASS: receipt-controlled opt out/re-enable; private contacts denied; five distinct publishers/day; repeats allowed');
 // Simulate the next day's quota by aging only this viewer's rows.
 localSQL('UPDATE contact_views SET day=? WHERE viewer_id=?',['2000-01-01',registered.data.id]);
 await viewer(`pilot/leads/${others[4].id}/contact`,'POST',{});
 console.log('PASS: previous-day views do not consume today’s slots');
 const phone=await create('members','13900000000','phone');const phoneContact=await viewer(`pilot/leads/${phone.id}/contact`,'POST',{});assert.equal(phoneContact.data.phone,'13900000000');assert.equal(phoneContact.data.wechat,'');
 for(const status of ['invalid','matched']){
  localSQL('UPDATE pilot_leads SET status=? WHERE id=?',[status,privateRow.id]);
  const {data}=await anon('listings?city=贵阳&demo=0');assert(!data.items.some(p=>p.id==='pilot-'+privateRow.id),'inactive pilot must be hidden');
  await anon('listings/pilot-'+privateRow.id,'GET',undefined,404);
 }
 localSQL("UPDATE pilot_leads SET status='new',created_at='2000-01-01T00:00:00.000Z' WHERE id=?",[privateRow.id]);
 assert(!(await anon('listings?city=贵阳&demo=0')).data.items.some(p=>p.id==='pilot-'+privateRow.id));
 await anon('listings/pilot-'+privateRow.id,'GET',undefined,404);
 console.log('PASS: inactive and expired pilot listings hidden consistently');
 await anon(`pilot/leads/${row.id}`,'DELETE',{receiptToken:row.token});row.deleted=true;
 await viewer(`pilot/leads/${row.id}/contact`,'POST',{},404);
 console.log('PASS: withdrawn contact unavailable even to a previous viewer');
}finally{
 for(const r of records)if(!r.deleted)await anon(`pilot/leads/${r.id}`,'DELETE',{receiptToken:r.token});
}
