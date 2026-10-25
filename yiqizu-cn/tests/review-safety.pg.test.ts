import {it,expect,describe} from 'vitest';
import {randomUUID} from 'node:crypto';
import {sql,sqlAsync,pgConfigured} from './pg-fixture';
describe.skipIf(!pgConfigured)('review concurrency safety',()=>{
it('cleanup_waits_for_avatar_binding_and_rechecks_committed_reference',async()=>{
 const user=randomUUID(),upload=randomUUID();sql(`INSERT INTO cn_users(id,email,password_hash,password_salt) VALUES('${user}','${user}@example.invalid',repeat('a',64),repeat('b',32)); INSERT INTO cn_uploads(id,owner_id,object_key,mime_type,size_bytes,state,created_at) VALUES('${upload}','${user}','cn-photos/${user}/${upload}','image/png',8,'ready',now()-interval '2 days');`);
 const binding=sqlAsync(`BEGIN; SELECT cn_profile_update('${user}','{"avatarUploadId":"${upload}"}'); SELECT pg_sleep(1); COMMIT;`);
 await new Promise(r=>setTimeout(r,200));await sqlAsync(`SELECT cn_cleanup_prepare(now(),25);`);await binding;
 expect(sql(`SELECT state FROM cn_uploads WHERE id='${upload}'`)).toBe('ready');
});
it('stale_moderation_cannot_resurrect_withdrawn_posts',()=>{
 const admin=randomUUID(),lead=randomUUID();sql(`INSERT INTO cn_users(id,email,password_hash,password_salt,role) VALUES('${admin}','${admin}@example.invalid',repeat('a',64),repeat('b',32),'admin'); INSERT INTO cn_leads(id,owner_id,kind,city,district,budget,min_lease_months,preferred_gender,data,housing,contact_type,contact_value,contact_visibility,source,visibility) VALUES('${lead}','${admin}','seeker','贵阳','云岩区',1000,3,'不限','{}',NULL,'wechat','test123','members','direct','withdrawn'); SELECT cn_operations_update('${admin}','${lead}',NULL,'active');`);
 expect(sql(`SELECT visibility FROM cn_leads WHERE id='${lead}'`)).toBe('withdrawn');
});
});
