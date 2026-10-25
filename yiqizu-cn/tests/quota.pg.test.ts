import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { AuthService } from "../server/auth";
import { LeadService } from "../server/leads";
import { testDb } from "./rpc-fixture";
import { pgConfigured, sql } from "./pg-fixture";
import { sampleLead } from "./lead-fixture";
const auth = new AuthService(testDb),
  leads = new LeadService(testDb);
async function actor() {
  const s = await auth.register(
    { email: randomUUID() + "@example.invalid", password: "password123" },
    randomUUID(),
  );
  return (await auth.resolveActor(s.token))!;
}
describe.skipIf(!pgConfigured)("real PostgreSQL quota concurrency", () => {
  it("two_concurrent_last_publish_slots_have_exactly_one_winner", async () => {
    const a = await actor();
    for (let i = 0; i < 2; i++) await leads.create(a, sampleLead, randomUUID());
    const r = await Promise.allSettled([
      leads.create(a, sampleLead, randomUUID()),
      leads.create(a, sampleLead, randomUUID()),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(
      sql(`SELECT count(*) FROM cn_publish_events WHERE user_id='${a.userId}'`),
    ).toBe("3");
  });
  it("distinct_contacts_five_and_six_cannot_both_consume_last_slot", async () => {
    const reader = await actor(),
      ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const owner = await actor();
      ids.push(
        (
          await leads.create(
            owner,
            { ...sampleLead, contact: `chen00${i}` },
            randomUUID(),
          )
        ).id,
      );
    }
    for (const id of ids.slice(0, 4)) await leads.contact(reader, id);
    const r = await Promise.allSettled(
      ids.slice(4).map((id) => leads.contact(reader, id)),
    );
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await leads.contact(reader, ids[0])).remaining).toBe(0);
  });
  it("operator_only_denial_does_not_consume_quota_and_shanghai_day_resets", async () => {
    const owner = await actor(),
      reader = await actor(),
      p = await leads.create(
        owner,
        { ...sampleLead, contactVisibility: "operator" },
        randomUUID(),
      );
    await expect(leads.contact(reader, p.id)).rejects.toMatchObject({
      status: 403,
    });
    expect(
      sql(
        `SELECT count(*) FROM cn_contact_views WHERE user_id='${reader.userId}'`,
      ),
    ).toBe("0");
    sql(
      `INSERT INTO cn_publish_events(user_id,day,request_id,payload_hash,lead_id) SELECT '${reader.userId}',(now() AT TIME ZONE 'Asia/Shanghai')::date-1,gen_random_uuid(),repeat('a',64),gen_random_uuid() FROM generate_series(1,3);`,
    );
    await expect(
      leads.create(reader, sampleLead, randomUUID()),
    ).resolves.toHaveProperty("id");
  });
});
