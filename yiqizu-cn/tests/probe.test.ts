import { describe, it, expect } from "vitest";
import { handleProbe, createAuthorizer, type ProbeDeps } from "../probe/main";

const token = "a".repeat(64);
const runId = "9e47ce03-8407-485b-b318-385650505ca8";
function deps() {
  let calls = 0;
  const d: ProbeDeps = {
    authorize: createAuthorizer(token),
    takeSlot: async () => {
      calls++;
      return calls === 1;
    },
    prepareUpload: async () => ({
      path: `cn-probe/${runId}/pixel.png`,
      token: "signed-token",
      url: "https://example.invalid/signed?token=private",
    }),
    probeStorage: async () => ({
      uploaded: true,
      readable: true,
      deleted: true,
    }),
  };
  return { d, calls: () => calls };
}
describe("capability probe security boundary", () => {
  it("rejects_missing_probe_token_without_resource_calls", async () => {
    const x = deps();
    const r = await handleProbe({ action: "prepare", runId }, x.d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.status).toBe(401);
    expect(x.calls()).toBe(0);
  });
  it("rejects_unconfigured_or_weak_probe_token", () => {
    expect(createAuthorizer(undefined)(token)).toBe(false);
    expect(createAuthorizer("password")("password")).toBe(false);
    expect(createAuthorizer(token)("b".repeat(64))).toBe(false);
  });
  it("accepts_configured_random_length_token_only", () => {
    expect(createAuthorizer(token)(token)).toBe(true);
    expect(createAuthorizer(token)(token + "x")).toBe(false);
  });
  it("rejects_path_traversal_run_id_without_resource_calls", async () => {
    const x = deps();
    const r = await handleProbe(
      { action: "prepare", runId: "../../real-user", token },
      x.d,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.status).toBe(400);
    expect(x.calls()).toBe(0);
  });
  it("rejects_unknown_actions", async () => {
    const x = deps();
    const r = await handleProbe(
      { action: "executeSql", runId, token, sql: "DROP SCHEMA public" },
      x.d,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.status).toBe(400);
    expect(x.calls()).toBe(0);
  });
  it("health_does_not_initialize_cloud_services", async () => {
    const x = deps();
    const r = await handleProbe({ action: "health" }, x.d);
    expect(r.ok).toBe(true);
    expect(x.calls()).toBe(0);
    expect(JSON.stringify(r)).not.toContain(token);
  });
  it("proves_one_final_slot_before_issuing_upload", async () => {
    const x = deps();
    const r = await handleProbe({ action: "prepare", runId, token }, x.d);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toMatchObject({ rpc: "passed", runId });
    }
    expect(x.calls()).toBe(2);
  });
  it("does_not_report_unsafe_concurrency_as_success", async () => {
    const x = deps();
    x.d.takeSlot = async () => true;
    const r = await handleProbe({ action: "prepare", runId, token }, x.d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("RPC_ATOMICITY_FAILED");
  });
  it("does_not_return_secrets_or_signed_urls_in_final_report", async () => {
    const x = deps();
    const r = await handleProbe({ action: "verify", runId, token }, x.d);
    expect(r.ok).toBe(true);
    const wire = JSON.stringify(r);
    expect(wire).not.toContain(token);
    expect(wire).not.toContain("signed-token");
    expect(wire).not.toContain("https://");
  });
  it("reports_unsupported_capability_as_failure_and_redacts_provider_error", async () => {
    const x = deps();
    x.d.prepareUpload = async () => {
      throw new Error("accessKey=secret https://evil.invalid/?token=secret");
    };
    const r = await handleProbe({ action: "prepare", runId, token }, x.d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("CAPABILITY_UNAVAILABLE");
    expect(JSON.stringify(r)).not.toMatch(/accessKey|evil|secret/);
  });
  it("partial_storage_result_cannot_pass", async () => {
    const x = deps();
    x.d.probeStorage = async () => ({
      uploaded: true,
      readable: true,
      deleted: false,
    });
    const r = await handleProbe({ action: "verify", runId, token }, x.d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("STORAGE_CHECK_FAILED");
  });
});
