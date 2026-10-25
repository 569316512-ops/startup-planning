import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {pgConfigured,sql,failure,literal} from './pg-fixture';
describe.skipIf(!pgConfigured)('real core PostgreSQL schema',()=>{
 it('defines_nine_private_business_tables',()=>{
  const result=sql("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'cn_%' AND tablename NOT LIKE 'cn_probe%' ORDER BY tablename");
  expect(result.split('\n')).toEqual(['cn_contact_views','cn_events','cn_feedback','cn_leads','cn_migrations','cn_publish_events','cn_rate_limits','cn_sessions','cn_uploads','cn_users']);
 });
 it('rejects_invalid_json_enum_and_duplicate_email',()=>{
  const id=randomUUID(),email=`${id}@example.invalid`,base=`INSERT INTO cn_users(id,email,password_hash,password_salt) VALUES('${id}',${literal(email)},repeat('a',64),repeat('b',32))`;
  sql(base);
  expect(failure(`UPDATE cn_users SET profile='[]' WHERE id='${id}'`)).toContain('23514');
  expect(failure(`UPDATE cn_users SET role='admin-from-client' WHERE id='${id}'`)).toContain('23514');
  expect(failure(`INSERT INTO cn_users(email,password_hash,password_salt) VALUES(${literal(email)},repeat('c',64),repeat('d',32))`)).toContain('23505');
  expect(failure(`UPDATE cn_users SET email=upper(email) WHERE id='${id}'`)).toContain('23514');
 });
 it.each(['anon','authenticated'])('denies_%s_every_business_table',role=>{
  for(const table of ['users','sessions','leads','uploads','publish_events','contact_views','events','feedback','rate_limits']){
   expect(failure(`SET ROLE ${role}; SELECT * FROM cn_${table} LIMIT 1;`)).toContain('42501');
   expect(failure(`SET ROLE ${role}; DELETE FROM cn_${table};`)).toContain('42501');
  }
 });
 it('reapplying_migration_preserves_existing_data',()=>{
  const before=sql('SELECT count(*) FROM cn_users;');sql(readFileSync('migrations/0001_core.sql','utf8'));
  expect(sql('SELECT count(*) FROM cn_users;')).toBe(before);expect(sql('SELECT count(*) FROM cn_migrations;')).toBe('1');
 });
 it('rejects_bad_session_upload_and_feedback_constraints',()=>{
  expect(failure("INSERT INTO cn_sessions(token_hash,user_id,expires_at) VALUES('raw-secret',gen_random_uuid(),now())")).toMatch(/23514|23503/);
  expect(failure("INSERT INTO cn_feedback(category,content,contact) VALUES('bug','x','')")).toContain('23514');
  expect(failure("INSERT INTO cn_events(event_id,session_id,event,city,source) VALUES(gen_random_uuid(),gen_random_uuid(),'unknown','贵阳','direct')")).toContain('23514');
 });
});
