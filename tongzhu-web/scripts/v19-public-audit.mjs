import {resetRates,grantFixtureMember} from './member-test-fixtures.mjs';
resetRates();
// Local-only audit: fixtures use normal sources to exercise public visibility.
// Never run this against production. All created leads are withdrawn in finally.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const origin=process.argv[2]||'http://127.0.0.1:5173';
assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname));
const persist=process.argv[3]||'.wrangler/state';
const records=[];let cookie='';const auth=await fetch(origin+'/api/v1/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'audit-'+crypto.randomUUID()+'@test.local',password:'Audit1234'})});const account=await auth.json();assert.equal(auth.status,200);cookie=auth.headers.get('set-cookie').split(';')[0];grantFixtureMember(account.id);
async function api(path,method='GET',body,status=200){const r=await fetch(origin+'/api/v1/'+path,{method,headers:{cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
async function create(source='direct',kind='seeker'){
 const token=crypto.randomUUID(),sessionId=crypto.randomUUID();
 const f=new FormData();for(const [k,v] of Object.entries({receiptToken:token,sessionId,adult:'true',consent:'true'}))f.append(k,v);
 f.append('file',new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')],'audit.png',{type:'image/png'}));
 const upload=await fetch(origin+'/api/v1/pilot/uploads',{method:'POST',body:f});assert.equal(upload.status,201);const photo=await upload.json();
 const lead={title:'本地公开验收标题',gender:'女',receiptToken:token,sessionId,kind,occupation:kind==='room'?'本地测试职业':'',city:'贵阳',district:'观山湖区',budget:1234,moveIn:new Date(Date.now()+14*86400000).toISOString().slice(0,10),nickname:'虚构验收',note:'本地自动化虚构需求，不是真实房源。',contactType:'wechat',contact:'audit_private_19',adult:true,consent:true,publicConsent:true,contactVisibility:'operator',source,photoIds:[photo.id],housing:kind==='room'?{community:'虚构验收小区',housingState:'rented',bedrooms:2,bathrooms:1,area:80,roomsAvailable:1,originalLayout:true,amenities:['电梯']}:undefined};
 await api('pilot/leads','POST',{...lead,publicConsent:false},400);
 const missing={...lead};delete missing.publicConsent;await api('pilot/leads','POST',missing,400);
 const saved=await api('pilot/leads','POST',lead,201);const row={id:saved.id,token,photo:photo.id};records.push(row);return row;
}
const feed=()=>api('listings?city=贵阳&demo=0');
try{
 for(const kind of ['seeker','room']){
  const row=await create('direct',kind),id='pilot-'+row.id;
  assert((await feed()).items.some(p=>p.id===id));const post=await api('listings/'+id);
  const json=JSON.stringify(post);for(const secret of ['audit_private_19',row.token,'receipt_hash','contact_value','session_id'])assert(!json.includes(secret));
  assert.equal(post.pilot,true);assert.equal(post.kind,kind);assert.equal(post.contactPublic,false);
  const image=await fetch(origin+'/api/v1/pilot/photos/public/'+row.photo);assert.equal(image.status,200);
  console.log('PASS: '+kind+' explicit consent, feed/detail/photo visibility, structured contact and receipt excluded');
  console.log('OBSERVED: public photo Cache-Control='+image.headers.get('cache-control'));
  // Emulate an existing pre-v19 private record in this checkout's local D1 only.
  execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to',persist,'--command',`UPDATE pilot_leads SET housing=json_remove(housing,'$.public') WHERE id='${row.id}'`],{stdio:'pipe'});
  assert(!(await feed()).items.some(p=>p.id===id));await api('listings/'+id,'GET',undefined,404);assert.equal((await fetch(origin+'/api/v1/pilot/photos/public/'+row.photo)).status,404);
  console.log('PASS: legacy record without public flag hidden from feed/detail/photos');
 }
 const test=await create('test');assert(!(await feed()).items.some(p=>p.id==='pilot-'+test.id));await api('listings/pilot-'+test.id,'GET',undefined,404);assert.equal((await fetch(origin+'/api/v1/pilot/photos/public/'+test.photo)).status,404);console.log('PASS: test source excluded from public feed/detail/photos');
 const row=await create();await api('pilot/leads/'+row.id,'DELETE',{receiptToken:crypto.randomUUID()},404);
 await api('pilot/admin','GET',undefined,403);
}finally{
 for(const row of records){await api('pilot/leads/'+row.id,'DELETE',{receiptToken:row.token});await api('listings/pilot-'+row.id,'GET',undefined,404);assert.equal((await fetch(origin+'/api/v1/pilot/photos/public/'+row.photo)).status,404);assert(!(await feed()).items.some(p=>p.id==='pilot-'+row.id));}
 console.log('PASS: all audit leads withdrawn; feed/detail and origin photos unavailable');
}
