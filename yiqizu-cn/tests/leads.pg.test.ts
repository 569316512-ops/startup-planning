import {describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {AuthService} from '../server/auth';
import {LeadService} from '../server/leads';
import {testDb} from './rpc-fixture';
import {pgConfigured,sql} from './pg-fixture';
import {sampleLead} from './lead-fixture';
const auth=new AuthService(testDb,[]),leads=new LeadService(testDb);
async function actor(){const s=await auth.register({email:randomUUID()+'@example.invalid',password:'password123'},randomUUID());return (await auth.resolveActor(s.token))!}
describe.skipIf(!pgConfigured)('transactional real PostgreSQL listings',()=>{
 it('retries_same_request_without_spending_quota_and_rejects_changed_payload',async()=>{
  const a=await actor(),key=randomUUID(),one=await leads.create(a,sampleLead,key),two=await leads.create(a,sampleLead,key);
  expect(two).toEqual(one);expect(sql(`SELECT count(*) FROM cn_publish_events WHERE user_id='${a.userId}'`)).toBe('1');
  await expect(leads.create(a,{...sampleLead,budget:999},key)).rejects.toMatchObject({status:409});
 });
 it('concurrent_edit_has_one_winner_and_other_users_cannot_edit_or_get_private_data',async()=>{
  const a=await actor(),other=await actor(),post=await leads.create(a,sampleLead,randomUUID());
  const r=await Promise.allSettled([leads.update(a,post.id,{...sampleLead,title:'编辑版本一'},1),leads.update(a,post.id,{...sampleLead,title:'编辑版本二'},1)]);
  expect(r.filter(x=>x.status==='fulfilled')).toHaveLength(1);
  await expect(leads.getOwned(other,post.id)).rejects.toMatchObject({status:403});
  await expect(leads.update(other,post.id,sampleLead,2)).rejects.toMatchObject({status:403});
  const pub=await leads.get(post.id,null);expect(pub).not.toHaveProperty('contact');expect(pub).not.toHaveProperty('contact_value');expect(pub).not.toHaveProperty('ownerId');expect(JSON.stringify(pub)).not.toContain('chen123');
 });
 it('invalid_upload_rolls_back_without_consuming_quota',async()=>{
  const a=await actor();await expect(leads.create(a,{...sampleLead,photoIds:[randomUUID()]},randomUUID())).rejects.toMatchObject({status:409});
  expect(sql(`SELECT count(*) FROM cn_publish_events WHERE user_id='${a.userId}'`)).toBe('0');
 });
 it('withdrawal_hides_publicly_and_does_not_refund_quota',async()=>{
  const a=await actor(),post=await leads.create(a,sampleLead,randomUUID());await leads.withdraw(a,post.id);
  await expect(leads.get(post.id,null)).rejects.toMatchObject({status:404});expect(sql(`SELECT count(*) FROM cn_publish_events WHERE user_id='${a.userId}'`)).toBe('1');
 });
 it('keyset_pagination_breaks_timestamp_ties_without_missing_posts',async()=>{
  const a=await actor();for(let i=0;i<3;i++)await leads.create(a,sampleLead,randomUUID());
  sql(`UPDATE cn_leads SET created_at='2026-10-24T00:00:00Z' WHERE owner_id='${a.userId}'`);
  const seen:string[]=[];let cursor:string|undefined;
  do{const page=await leads.list({mine:true,limit:1,cursor},a);seen.push(...page.items.map(p=>p.id));cursor=page.nextCursor??undefined}while(cursor);
  expect(new Set(seen).size).toBe(3);
 });
});
