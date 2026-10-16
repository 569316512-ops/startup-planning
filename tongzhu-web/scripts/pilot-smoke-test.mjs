import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const origin=process.argv[2]||'http://127.0.0.1:5188';
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'Pilot checks are local-only');
const operator={'oai-authenticated-user-id':'local-test-operator','oai-authenticated-user-email':'pilot-owner@test.local'};
async function call(path,method='GET',body,expected=200,headers={}){const r=await fetch(origin+'/api/v1/pilot/'+path,{method,headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,expected,`${method} ${path}: ${JSON.stringify(data)}`);return data;}
const sessionId=crypto.randomUUID(),receiptToken=crypto.randomUUID();
const date=new Date(Date.now()+14*86400000).toISOString().slice(0,10);
const lead={sessionId,receiptToken,kind:'seeker',city:'贵阳',district:'观山湖区',budget:1200,moveIn:date,note:'本地测试：希望通勤方便，作息规律，不是真实求租。',nickname:'本地虚构测试',contactType:'wechat',contact:'local_test_only',adult:true,consent:true,publicConsent:true,source:'test',website:''};
const event={event:'visit',sessionId,eventId:crypto.randomUUID(),city:'贵阳',source:'test'};
await call('events','POST',event);await call('events','POST',event);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
async function upload(token=receiptToken,{consent=true,bytes=png,type='image/png',expected=201}={}){const f=new FormData();f.append('file',new File([bytes],'test.png',{type}));f.append('receiptToken',token);f.append('sessionId',sessionId);f.append('adult','true');f.append('consent',String(consent));const r=await fetch(origin+'/api/v1/pilot/uploads',{method:'POST',body:f});const d=await r.json();assert.equal(r.status,expected,JSON.stringify(d));return d;}
await upload(crypto.randomUUID(),{consent:false,expected:400});await upload(crypto.randomUUID(),{bytes:Buffer.from('not-a-photo'),expected:400});
const image=await upload(),secondImage=await upload();lead.photoIds=[image.id,secondImage.id];
await call('photos/'+image.id,'GET',null,403);
assert.equal((await fetch(origin+'/api/v1/uploads/pilot/'+createHash('sha256').update(receiptToken).digest('hex')+'/'+image.id)).status,404);
assert.equal((await fetch(origin+'/api/v1/pilot/photos/'+image.id,{headers:{'x-pilot-receipt':receiptToken}})).status,200);
assert.equal((await fetch(origin+'/api/v1/pilot/photos/'+image.id,{headers:{'x-pilot-receipt':crypto.randomUUID()}})).status,404);
await call('leads','POST',{...lead,receiptToken:crypto.randomUUID()},400);
await call('leads','POST',{...lead,receiptToken:crypto.randomUUID(),photoIds:[]},400);
await call('leads','POST',{...lead,kind:'room'},400);
const created=await call('leads','POST',lead,201);
try{
 const again=await call('leads','POST',lead);assert.equal(again.id,created.id);assert.equal(again.duplicate,true);
 const admin=await call('admin','GET',null,200,operator);const row=admin.leads.find(x=>x.id===created.id);assert.equal(row.contact_value,'local_test_only');assert.equal(row.contact_type,'wechat');assert.deepEqual(JSON.parse(row.photo_ids),[image.id,secondImage.id]);assert.equal(admin.sources.some(x=>x.source==='test'),false);
 await call(`leads/${created.id}`,'PUT',{status:'contacted'},200,operator);
 assert.equal((await call('admin','GET',null,200,operator)).leads.find(x=>x.id===created.id).status,'contacted');
 await call('admin','GET',null,403);await call(`leads/${created.id}`,'GET',null,404);await call(`leads/${created.id}`,'PUT',{status:'matched'},403);
 await call('leads','POST',{...lead,receiptToken:crypto.randomUUID(),consent:false},400);
 await call('leads','POST',{...lead,receiptToken:crypto.randomUUID(),adult:false},400);
 await call('leads','POST',{...lead,receiptToken:crypto.randomUUID(),city:'北京'},400);
 await call('leads','POST',{...lead,receiptToken:crypto.randomUUID(),moveIn:'2026-02-30'},400);
 await call('leads','POST',{...lead,receiptToken:crypto.randomUUID(),contactType:'phone',contact:'not-phone'},400);
 await call(`leads/${created.id}`,'DELETE',{receiptToken:crypto.randomUUID()},404);
}finally{await call(`leads/${created.id}`,'DELETE',{receiptToken});}
assert.equal((await call('admin','GET',null,200,operator)).leads.some(x=>x.id===created.id),false);
assert.equal((await fetch(origin+'/api/v1/pilot/photos/'+image.id,{headers:{'x-pilot-receipt':receiptToken}})).status,404);
assert.equal((await fetch(origin+'/api/v1/pilot/photos/'+secondImage.id,{headers:{'x-pilot-receipt':receiptToken}})).status,404);
const roomToken=crypto.randomUUID(),roomPhotos=[];for(let i=0;i<7;i++)roomPhotos.push(await upload(roomToken));const housing={community:'本地虚构小区',housingState:'rented',bedrooms:2,bathrooms:1,area:89,roomsAvailable:1,originalLayout:true,amenities:['电梯','可做饭','投影仪']};const room={...lead,kind:'room',housing,receiptToken:roomToken,photoIds:roomPhotos.map(photo=>photo.id)};
await call('leads','POST',{...room,housing:{...housing,originalLayout:false}},400);
await call('leads','POST',{...room,housing:{...housing,area:0}},400);
await call('leads','POST',{...room,housing:{...housing,amenities:[]}},400);
await call('leads','POST',{...room,nickname:' '},400);
await call('leads','POST',{...room,housing:{...housing,roomsAvailable:3}},400);
const r=await call('leads','POST',room,201);try{const saved=(await call('admin','GET',null,200,operator)).leads.find(x=>x.id===r.id);assert.deepEqual({...JSON.parse(saved.housing),amenities:[...JSON.parse(saved.housing).amenities].sort()},{...housing,amenities:[...housing.amenities].sort()});assert.deepEqual(JSON.parse(saved.photo_ids),roomPhotos.map(photo=>photo.id));const res=await fetch(origin+'/api/v1/pilot/photos/'+roomPhotos[0].id,{headers:operator});assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'image/png');}finally{await call(`leads/${r.id}`,'DELETE',{receiptToken:roomToken});}
for(const photo of roomPhotos)assert.equal((await fetch(origin+'/api/v1/pilot/photos/'+photo.id,{headers:operator})).status,404);
console.log('PASS: housing persistence and validation, required private photos, upload consent/type checks, photo ownership, image deletion on withdrawal; anonymous intake, one contact, idempotency, operator access, private contacts, stage updates, consent/age/date/city validation, receipt withdrawal, test-data exclusion.');
