import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {globSync} from 'node:fs';
import {client} from './member-test-client.mjs';
import {localSQL,resetRates,grantFixtureMember} from './member-test-fixtures.mjs';
const storedPhoto=id=>{const paths=globSync('.wrangler/member-tests/v3/r2/miniflare-R2BucketObject/*.sqlite').filter(p=>!p.endsWith('/metadata.sqlite'));assert(paths.length>0);return paths.reduce((n,path)=>{const db=new DatabaseSync(path);try{return n+db.prepare('SELECT COUNT(*) AS n FROM _mf_objects WHERE key LIKE ?').get('%/'+id).n}finally{db.close()}},0)};
resetRates();const owner=client(),viewer=client(),anon=client();
const user=await owner('auth/register','POST',{email:crypto.randomUUID()+'@retention.test',password:'Retention1234'});
await viewer('auth/register','POST',{email:crypto.randomUUID()+'@retention.test',password:'Retention1234'});
grantFixtureMember(user.id);localSQL("UPDATE users SET role='admin' WHERE id=?",[user.id]);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
async function upload(receiptToken){const f=new FormData();for(const [k,v] of Object.entries({receiptToken,sessionId:crypto.randomUUID(),adult:'true',consent:'true'}))f.set(k,v);f.set('file',new File([png],'fixture.png',{type:'image/png'}));return (await owner('pilot/uploads','POST',f,201)).id;}
const seed={title:'保留期限测试求租',gender:'女',moveIn:'11月底',kind:'seeker',city:'贵阳',district:'观山湖区',budget:1200,note:'只用于本地保留期限回归测试。',nickname:'期限测试',contactType:'wechat',contact:'retention01',adult:true,consent:true,publicConsent:true,contactVisibility:'members',source:'direct'};
const fixtures=[];
for(const age of [45,150,210]){const receiptToken=crypto.randomUUID(),photo=await upload(receiptToken);const made=await owner('pilot/leads','POST',{...seed,sessionId:crypto.randomUUID(),receiptToken,photoIds:[photo]},201);fixtures.push({id:made.id,photo,age});}
// Wait for publish's deferred cleanup before aging fixtures.
await new Promise(r=>setTimeout(r,250));
for(const f of fixtures){localSQL('UPDATE pilot_leads SET created_at=? WHERE id=?',[new Date(Date.now()-f.age*86400000).toISOString(),f.id]);localSQL('UPDATE pilot_uploads SET created_at=? WHERE id=?',[new Date(Date.now()-220*86400000).toISOString(),f.photo]);}
const orphan=await upload(crypto.randomUUID());localSQL('UPDATE pilot_uploads SET created_at=? WHERE id=?',[new Date(Date.now()-2*86400000).toISOString(),orphan]);
const old=fixtures[2];await anon('listings/pilot-'+old.id,'GET',undefined,404);await anon('pilot/photos/public/'+old.photo,'GET',undefined,404);
for(const f of fixtures)assert.equal(storedPhoto(f.photo),1);assert.equal(storedPhoto(orphan),1);
const admin=await owner('pilot/admin');
for(const f of fixtures.slice(0,2)){
 assert.equal(storedPhoto(f.photo),1,'retained R2 object');
 assert(admin.leads.some(l=>l.id===f.id),'30+ day lead must remain in operations');
 assert.equal((await anon('listings/pilot-'+f.id)).title,seed.title);
 assert((await owner('pilot/leads/'+f.id+'/content')).updatedAt);
 assert((await anon('pilot/photos/public/'+f.photo)) instanceof Buffer,'linked old upload must survive with retained lead');
 await viewer('pilot/leads/'+f.id+'/contact','POST',{});
}
assert(!admin.leads.some(l=>l.id===old.id));
assert.equal(localSQL('UPDATE pilot_leads SET note=note WHERE id=?',[old.id]).changes,0,'expired lead physically removed');
for(const id of [old.photo,orphan]){
 assert.equal(storedPhoto(id),0,'R2 object removed');
 assert.equal(localSQL('UPDATE pilot_uploads SET content_type=content_type WHERE id=?',[id]).changes,0,'expired/orphan upload metadata removed');
 await owner('pilot/photos/'+id,'GET',undefined,404);
}
const feed=await anon('listings?demo=0');for(const f of fixtures.slice(0,2))assert(feed.items.some(l=>l.id==='pilot-'+f.id));assert(!feed.items.some(l=>l.id==='pilot-'+old.id));
console.log('PASS: 45/150-day leads remain in operations/feed/detail/edit/contact/photos; 210-day leads and photos removed; 24h orphan cleanup preserved; old linked photos retained');
