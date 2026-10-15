import assert from 'node:assert/strict';
const origin=process.argv[2]||'http://127.0.0.1:5188';
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'Pilot checks are local-only');
const operator={'oai-authenticated-user-id':'local-test-operator','oai-authenticated-user-email':'pilot-owner@test.local'};
async function call(path,method='GET',body,expected=200,headers={}){const r=await fetch(origin+'/api/v1/pilot/'+path,{method,headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,expected,`${method} ${path}: ${JSON.stringify(data)}`);return data;}
const sessionId=crypto.randomUUID(),receiptToken=crypto.randomUUID();
const date=new Date(Date.now()+14*86400000).toISOString().slice(0,10);
const lead={sessionId,receiptToken,kind:'seeker',city:'贵阳',district:'观山湖区',budget:1200,moveIn:date,note:'本地测试：希望通勤方便，作息规律，不是真实求租。',nickname:'本地虚构测试',contactType:'wechat',contact:'local_test_only',adult:true,consent:true,source:'test',website:''};
const event={event:'visit',sessionId,eventId:crypto.randomUUID(),city:'贵阳',source:'test'};
await call('events','POST',event);await call('events','POST',event);
const created=await call('leads','POST',lead,201);
try{
 const again=await call('leads','POST',lead);assert.equal(again.id,created.id);assert.equal(again.duplicate,true);
 const admin=await call('admin','GET',null,200,operator);const row=admin.leads.find(x=>x.id===created.id);assert.equal(row.contact_value,'local_test_only');assert.equal(row.contact_type,'wechat');assert.equal(admin.sources.some(x=>x.source==='test'),false);
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
console.log('PASS: anonymous intake, one contact, idempotency, operator access, private contacts, stage updates, consent/age/date/city validation, receipt withdrawal, test-data exclusion.');
