// @vitest-environment jsdom
import { it, expect } from "vitest";
import { createApi } from "../src/client";
import { makeSession } from "../src/session";
it("rejects_html_and_malformed_results_and_sanitizes_transport_errors", async () => {
  const session = makeSession();
  session.set("test");
  for (const output of [
    "<html>error</html>",
    { ok: true },
    { ok: false, error: { status: 401 } },
  ])
    await expect(
      createApi(async () => output, session)("leads.list", {}),
    ).rejects.toThrow("服务暂时不可用");
  await expect(
    createApi(async () => {
      throw new Error("raw-secret");
    }, session)("leads.list", {}),
  ).rejects.not.toThrow("raw-secret");
});
it("401_clears_session_403_preserves_it_and_request_id_is_reused", async () => {
  const session = makeSession();
  session.set("private-token");
  let sent: unknown;
  const fail = (status: number) =>
    createApi(async (req) => {
      sent = req;
      return {
        ok: false,
        requestId: req.requestId,
        error: { status, code: "DENIED", message: "访问被拒绝" },
      };
    }, session);
  await expect(
    fail(403)("leads.create", {}, { requestId: "fixed-request" }),
  ).rejects.toThrow();
  expect(session.get()).toBe("private-token");
  expect(sent).toMatchObject({ requestId: "fixed-request" });
  await expect(fail(401)("profile.get", {})).rejects.toThrow();
  expect(session.get()).toBeNull();
});
