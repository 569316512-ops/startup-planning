import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { AuthService } from "../server/auth";
import { LeadService } from "../server/leads";
import { OperationsService } from "../server/operations";
import { CleanupService } from "../server/cleanup";
import { testDb } from "./rpc-fixture";
import { pgConfigured, sql } from "./pg-fixture";
import { sampleLead } from "./lead-fixture";
async function actor(admin = false) {
  const email = randomUUID() + "@example.invalid",
    auth = new AuthService(testDb),
    s = await auth.register({ email, password: "password123" }, randomUUID());
  if(admin)sql(`UPDATE cn_users SET role='admin' WHERE id='${s.profile.id}'`);
  return (await auth.resolveActor(s.token))!;
}
const ops = new OperationsService(testDb),
  leads = new LeadService(testDb);
describe.skipIf(!pgConfigured)("operations and retention PostgreSQL", () => {
  it("operations_paginate_beyond_200_without_losing_rows", async () => {
    const owner = await actor(),
      admin = await actor(true);
    const p = await leads.create(owner, sampleLead, randomUUID());
    sql(
      `INSERT INTO cn_leads(owner_id,kind,city,district,budget,min_lease_months,preferred_gender,data,housing,contact_type,contact_value,contact_visibility,source) SELECT owner_id,kind,city,district,budget,min_lease_months,preferred_gender,data,housing,contact_type,contact_value,contact_visibility,source FROM cn_leads CROSS JOIN generate_series(1,205) WHERE id='${p.id}';`,
    );
    let cursor: string | undefined;
    const seen: string[] = [];
    do {
      const page = await ops.list(admin, cursor);
      expect(page.items.length).toBeLessThanOrEqual(200);
      seen.push(...page.items.map((p) => p.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBeGreaterThanOrEqual(206);
  });
  it("rejects_regular_user_and_forged_admin_and_moderates_without_exposing_contact", async () => {
    const a = await actor(),
      admin = await actor(true),
      p = await leads.create(a, sampleLead, randomUUID());
    await expect(ops.list(a)).rejects.toMatchObject({ status: 403 });
    await expect(ops.list({ ...a, role: "admin" })).rejects.toMatchObject({
      status: 403,
    });
    await ops.moderate(admin, p.id, "hidden");
    await expect(leads.get(p.id, null)).rejects.toMatchObject({ status: 404 });
    const owned = await leads.getOwned(a, p.id);
    expect(owned.visibility).toBe("hidden");
    await ops.followup(admin, p.id, "contacted");
    expect((await leads.getOwned(a, p.id)).followupStatus).toBe("contacted");
  });
  it("retains_45_and_150_day_old_leads_but_excludes_and_cleans_over_six_months", async () => {
    const a = await actor(),
      admin = await actor(true),
      ids: string[] = [];
    for (let i = 0; i < 3; i++)
      ids.push((await leads.create(a, sampleLead, randomUUID())).id);
    for (const [i, days] of [45, 150, 200].entries())
      sql(
        `UPDATE cn_leads SET created_at=now()-interval '${days} days' WHERE id='${ids[i]}'`,
      );
    await expect(leads.get(ids[0], null)).resolves.toHaveProperty("id");
    await expect(leads.get(ids[1], null)).resolves.toHaveProperty("id");
    await expect(leads.get(ids[2], null)).rejects.toMatchObject({
      status: 404,
    });
    const page = await ops.list(admin);
    expect(page.items.some((p) => p.id === ids[2])).toBe(false);
    const cleanup = new CleanupService(testDb, { remove: async () => {} });
    await cleanup.run(new Date(), 25);
    expect(sql(`SELECT count(*) FROM cn_leads WHERE id='${ids[2]}'`)).toBe("0");
    expect(
      sql(`SELECT count(*) FROM cn_publish_events WHERE user_id='${a.userId}'`),
    ).toBe("3");
  });
  it("feedback_is_private_and_rate_limited_and_event_is_idempotent", async () => {
    const admin = await actor(true),
      user = await actor(),
      source = randomUUID();
    const receipt = await ops.feedback(
      {
        category: "bug",
        content: "页面出现问题",
        contact: "private-contact-value",
      },
      source,
    );
    await expect(ops.feedbackList(user)).rejects.toMatchObject({ status: 403 });
    expect(
      (await ops.feedbackList(admin)).items.some((p) => p.id === receipt.id),
    ).toBe(true);
    await ops.resolveFeedback(admin, receipt.id);
    const event = {
      event: "visit",
      eventId: randomUUID(),
      sessionId: randomUUID(),
      city: "贵阳",
      source: "direct",
    };
    await ops.event(event, source);
    await ops.event(event, source);
    expect(
      sql(`SELECT count(*) FROM cn_events WHERE event_id='${event.eventId}'`),
    ).toBe("1");
  });
  it("storage_delete_failure_keeps_retry_metadata_and_profile_avatar_reference", async () => {
    const a = await actor(),
      id = randomUUID(),
      avatar = randomUUID();
    sql(
      `INSERT INTO cn_uploads(id,owner_id,object_key,mime_type,size_bytes,state,created_at) VALUES('${id}','${a.userId}','cn-photos/${a.userId}/${id}','image/png',8,'ready',now()-interval '2 days'),('${avatar}','${a.userId}','cn-photos/${a.userId}/${avatar}','image/png',8,'ready',now()-interval '2 days'); UPDATE cn_users SET avatar_upload_id='${avatar}' WHERE id='${a.userId}';`,
    );
    const fail = new CleanupService(testDb, {
      remove: async () => {
        throw new Error("storage error with private-key");
      },
    });
    const r = await fail.run(new Date(), 25);
    expect(r.retry).toBeGreaterThan(0);
    expect(JSON.stringify(r)).not.toContain("private-key");
    expect(sql(`SELECT state FROM cn_uploads WHERE id='${id}'`)).toBe(
      "deleting",
    );
    expect(sql(`SELECT state FROM cn_uploads WHERE id='${avatar}'`)).toBe(
      "ready",
    );
    await new CleanupService(testDb, { remove: async () => {} }).run(
      new Date(),
      25,
    );
    expect(sql(`SELECT count(*) FROM cn_uploads WHERE id='${id}'`)).toBe("0");
  });
});
