import { describe, it, expect } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { AuthService } from "../server/auth";
import { ProfileService } from "../server/profile";
import { testDb } from "./rpc-fixture";
import { pgConfigured, sql, literal } from "./pg-fixture";
const auth = new AuthService(testDb),
  source = randomUUID();
const account = () => ({
  email: `${randomUUID()}@example.invalid`,
  password: "password123",
});
describe.skipIf(!pgConfigured)("real PostgreSQL app accounts", () => {
  it('public_registration_never_grants_admin_even_for_configured_email',async()=>{
    const input=account(),service=new AuthService(testDb);
    const s=await service.register({...input,role:'admin'},randomUUID());
    expect(s.profile.isAdmin).toBe(false);expect((await service.resolveActor(s.token))?.role).toBe('user');
  });
  it("duplicate_email_is_atomic", async () => {
    const input = account();
    const r = await Promise.allSettled([
      auth.register(input, randomUUID()),
      auth.register(input, randomUUID()),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });
  it("random_token_stored_only_as_hash", async () => {
    const input = account(),
      s = await auth.register(input, source);
    expect(s.token).toMatch(/^[a-f0-9]{64}$/);
    expect(s.profile.email).toBe(input.email);
    expect(JSON.stringify(s)).not.toMatch(/password_hash|password_salt/);
    expect(
      sql(`SELECT token_hash FROM cn_sessions WHERE user_id='${s.profile.id}'`),
    ).toBe(createHash("sha256").update(s.token).digest("hex"));
    expect(await auth.resolveActor(s.token)).toEqual({
      userId: s.profile.id,
      role: "user",
    });
    expect(await auth.resolveActor("fake")).toBeNull();
  });
  it("expired_or_revoked_session_denied", async () => {
    const s = await auth.register(account(), source);
    await auth.logout(s.token);
    expect(await auth.resolveActor(s.token)).toBeNull();
    const t = await auth.login(
      { email: s.profile.email, password: "password123" },
      source,
    );
    sql(
      `UPDATE cn_sessions SET created_at=now()-interval '8 days',expires_at=now()-interval '1 day' WHERE user_id='${s.profile.id}'`,
    );
    expect(await auth.resolveActor(t.token)).toBeNull();
  });
  it("password_change_revokes_all_sessions_and_keeps_password_whitespace", async () => {
    const input = account(),
      s = await auth.register(input, source),
      t = await auth.login(input, source),
      actor = (await auth.resolveActor(s.token))!;
    await auth.changePassword(actor, {
      oldPassword: input.password,
      password: " Newpassword2 ",
    });
    expect(await auth.resolveActor(s.token)).toBeNull();
    expect(await auth.resolveActor(t.token)).toBeNull();
    await expect(
      auth.login({ ...input, password: "Newpassword2" }, source),
    ).rejects.toMatchObject({ status: 401 });
    expect(
      (await auth.login({ ...input, password: " Newpassword2 " }, source))
        .profile.id,
    ).toBe(actor.userId);
  });
  it("profile_partial_save_cannot_set_admin_or_another_email", async () => {
    const s = await auth.register(account(), source),
      actor = (await auth.resolveActor(s.token))!;
    const profiles = new ProfileService(testDb);
    await profiles.update(actor, {
      nickname: "小李",
      bio: "朝九晚五，喜欢运动",
      isAdmin: true,
      email: "admin@example.invalid",
      contact: { wechat: "li123456" },
    });
    const p = await profiles.get(actor);
    expect(p.nickname).toBe("小李");
    expect(p.bio).toContain("喜欢运动");
    expect(p.isAdmin).toBe(false);
    expect(p.email).toBe(s.profile.email);
    expect(p.contact.phone).toBe("");
    await profiles.update(actor, { bio: "" });
    expect((await profiles.get(actor)).bio).toBe("");
  });
  it("requires_trusted_transport_identity_and_applies_database_limits", async () => {
    await expect(auth.register(account(), "")).rejects.toMatchObject({
      status: 503,
    });
    const email = account().email,
      identity = randomUUID();
    for (let i = 0; i < 10; i++)
      await expect(
        auth.login({ email, password: "password123" }, identity),
      ).rejects.toMatchObject({ status: 401 });
    await expect(
      auth.login({ email, password: "password123" }, identity),
    ).rejects.toMatchObject({ status: 429 });
  });
  it("anon_and_authenticated_cannot_execute_server_only_auth_rpc", () => {
    for (const role of ["anon", "authenticated"]) {
      let error = "";
      try {
        sql(
          `SET ROLE ${role}; SELECT cn_auth_user(${literal("x@example.invalid")});`,
        );
      } catch (e) {
        error = String((e as { stderr: unknown }).stderr);
      }
      expect(error).toContain("42501");
    }
  });
});
