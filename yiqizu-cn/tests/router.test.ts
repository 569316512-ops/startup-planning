import { it, expect } from "vitest";
import { createRouter } from "../server/main";
it("anonymous_cloudbase_identity_is_not_actor_and_forged_headers_are_ignored", async () => {
  const route = createRouter(
    { resolveActor: async () => null } as never,
    {} as never,
  );
  const r = await route(
    {
      version: 1,
      requestId: "test",
      action: "profile.get",
      payload: {
        ownerId: "victim",
        role: "admin",
        "oai-authenticated-email": "admin@example.invalid",
      },
    },
    "transport-visitor",
  );
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.status).toBe(401);
});
it("rejects_unknown_actions_and_redacts_internal_failures", async () => {
  const route = createRouter(
    {
      resolveActor: async () => {
        throw new Error("secret SQL token");
      },
    } as never,
    {} as never,
  );
  const r = await route(
    {
      version: 1,
      requestId: "test",
      action: "profile.get",
      payload: {},
      sessionToken: "x",
    },
    "trusted",
  );
  expect(JSON.stringify(r)).not.toMatch(/secret|SQL|token/);
  const unknown = await route(
    { version: 1, requestId: "test", action: "sql.execute", payload: {} },
    "trusted",
  );
  expect(unknown.ok).toBe(false);
  if (!unknown.ok) expect(unknown.error.status).toBe(400);
});
