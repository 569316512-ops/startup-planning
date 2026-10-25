import {describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {AuthService} from '../server/auth';
import {UploadService,type StoragePort} from '../server/uploads';
import {LeadService} from '../server/leads';
import {testDb} from './rpc-fixture';
import {pgConfigured} from './pg-fixture';
import {sampleLead} from './lead-fixture';
const png=new Uint8Array([137,80,78,71,13,10,26,10]);
const auth=new AuthService(testDb,[]),leads=new LeadService(testDb);
const storage:StoragePort={issueUpload:async key=>({path:key,token:'limited',url:'https://example.invalid/upload'}),inspect:async()=>({size:8,type:'image/png',header:png}),readUrl:async()=> 'https://example.invalid/signed',remove:async()=>{}};
async function actor(){const s=await auth.register({email:randomUUID()+'@example.invalid',password:'password123'},randomUUID());return (await auth.resolveActor(s.token))!}
describe.skipIf(!pgConfigured)('owned upload PostgreSQL integration',()=>{
 it('rejects_other_owner_unfinalized_and_cross_post_rebinding',async()=>{
  const a=await actor(),other=await actor(),service=new UploadService(testDb,storage),u=await service.begin(a,{type:'image/png',size:8});
  await expect(service.finalize(other,u.uploadId)).rejects.toMatchObject({status:403});
  await expect(leads.create(a,{...sampleLead,photoIds:[u.uploadId]},randomUUID())).rejects.toMatchObject({status:409});
  await service.finalize(a,u.uploadId);await leads.create(a,{...sampleLead,photoIds:[u.uploadId]},randomUUID());
  await expect(leads.create(a,{...sampleLead,photoIds:[u.uploadId]},randomUUID())).rejects.toMatchObject({status:409});
 });
 it('rejects_mime_magic_or_actual_size_mismatch',async()=>{
  const a=await actor(),service=new UploadService(testDb,{...storage,inspect:async()=>({size:8,type:'image/png',header:new Uint8Array([1,2,3])})}),u=await service.begin(a,{type:'image/png',size:8});
  await expect(service.finalize(a,u.uploadId)).rejects.toMatchObject({status:400});
  const large=new UploadService(testDb,{...storage,inspect:async()=>({size:5242881,type:'image/png',header:png})});
  await expect(large.finalize(a,u.uploadId)).rejects.toMatchObject({status:400});
 });
 it('only_signs_public_active_photos_or_own_private_photos_for_at_most_300s',async()=>{
  const a=await actor(),service=new UploadService(testDb,{...storage,readUrl:async(_key,seconds)=>{expect(seconds).toBeLessThanOrEqual(300);return 'https://example.invalid/signed'}}),u=await service.begin(a,{type:'image/png',size:8});
  await service.finalize(a,u.uploadId);await expect(service.urls([u.uploadId],null)).rejects.toMatchObject({status:404});
  const post=await leads.create(a,{...sampleLead,photoIds:[u.uploadId]},randomUUID());expect((await service.urls([u.uploadId],null))[u.uploadId]).toMatch(/^https:/);
  await leads.withdraw(a,post.id);await expect(service.urls([u.uploadId],null)).rejects.toMatchObject({status:404});
  expect((await service.urls([u.uploadId],a))[u.uploadId]).toMatch(/^https:/);
 });
});
