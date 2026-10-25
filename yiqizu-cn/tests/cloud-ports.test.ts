import { describe, it, expect } from "vitest";
import { takeProbeSlot } from "../server/db";
import {
  prepareProbeUpload,
  verifyProbeStorage,
  type ProbeStorageBucket,
} from "../server/storage";
import { PIXEL_BASE64 } from "../shared/contracts";
const runId = "9e47ce03-8407-485b-b318-385650505ca8";
const path = `cn-probe/${runId}/pixel.png`;
const pixel = new Uint8Array(Buffer.from(PIXEL_BASE64, "base64"));
function bucket() {
  let removed = false;
  const b: ProbeStorageBucket & {
    exists: (path: string) => Promise<{ data: boolean; error: null }>;
  } = {
    createSignedUploadUrl: async (p) => ({
      data: {
        path: p,
        token: "scoped-token",
        fullSignedURL: "https://example.invalid/upload",
      },
      error: null,
    }),
    info: async () =>
      removed
        ? { data: null, error: { status: 404, code: "NoSuchKey" } }
        : {
            data: { size: pixel.length, contentType: "image/png" },
            error: null,
          },
    download: async () => ({ data: new Blob([pixel]), error: null }),
    createSignedUrl: async () => ({
      data: { fullSignedURL: "https://example.invalid/read" },
      error: null,
    }),
    remove: async () => {
      removed = true;
      return { data: [{ name: path }], error: null };
    },
    exists: async () => ({ data: false, error: null }),
  };
  return b;
}
describe("cloud probe adapters", () => {
  it("accepts_explicit_json_true_and_false_without_sdk_falsy_coercion", async () => {
    for (const taken of [true, false])
      expect(
        await takeProbeSlot(
          {
            rpc: async (name) => {
              expect(name).toBe("cn_probe_take_slot_v2");
              return { data: { taken }, error: null };
            },
          },
          runId,
        ),
      ).toBe(taken);
  });
  it.each([{}, true, false, { taken: "false" }, null])(
    "rejects_malformed_rpc_result_%j",
    async (data) => {
      await expect(
        takeProbeSlot({ rpc: async () => ({ data, error: null }) }, runId),
      ).rejects.toThrow();
    },
  );
  it("does_not_accept_provider_rpc_error_as_no_slot", async () => {
    await expect(
      takeProbeSlot(
        { rpc: async () => ({ data: null, error: { code: "42501" } }) },
        runId,
      ),
    ).rejects.toThrow();
  });
  it("upload_grant_is_for_one_exact_path_with_no_upsert", async () => {
    const b = bucket();
    b.createSignedUploadUrl = async (p, options) => {
      expect(p).toBe(path);
      expect(options).toEqual({ upsert: false });
      return {
        data: {
          path: p,
          token: "scope",
          fullSignedURL: "https://example.invalid/u",
        },
        error: null,
      };
    };
    expect((await prepareProbeUpload(b, runId)).path).toBe(path);
  });
  it("rejects_provider_changed_upload_path", async () => {
    const b = bucket();
    b.createSignedUploadUrl = async () => ({
      data: {
        path: "someone/avatar.png",
        token: "scope",
        fullSignedURL: "https://example.invalid/u",
      },
      error: null,
    });
    await expect(prepareProbeUpload(b, runId)).rejects.toThrow();
  });
  it("checks_actual_bytes_signed_read_and_actual_deletion", async () => {
    const report = await verifyProbeStorage(
      bucket(),
      runId,
      async () => new Response(pixel),
    );
    expect(report).toEqual({ uploaded: true, readable: true, deleted: true });
  });
  it("rejects_non_fixture_photo_and_does_not_delete_it", async () => {
    const b = bucket();
    b.download = async () => ({ data: new Blob(["not pixel"]), error: null });
    b.remove = async () => {
      throw new Error("should never delete non-fixture");
    };
    await expect(
      verifyProbeStorage(b, runId, async () => new Response(pixel)),
    ).rejects.toThrow("FIXTURE_MISMATCH");
  });
  it("signing_success_without_read_success_does_not_pass", async () => {
    await expect(
      verifyProbeStorage(
        bucket(),
        runId,
        async () => new Response("denied", { status: 403 }),
      ),
    ).rejects.toThrow();
  });
  it("delete_ack_without_object_disappearing_does_not_pass", async () => {
    const b = bucket();
    b.info = async () => ({
      data: { size: pixel.length, contentType: "image/png" },
      error: null,
    });
    const report = await verifyProbeStorage(
      b,
      runId,
      async () => new Response(pixel),
    );
    expect(report.deleted).toBe(false);
  });
  it("invalid_jwt_after_delete_is_not_proof_of_object_deletion", async () => {
    const b = bucket();
    let reads = 0;
    b.info = async () =>
      ++reads === 1
        ? {
            data: { size: pixel.length, contentType: "image/png" },
            error: null,
          }
        : { data: null, error: { status: 400, statusCode: "InvalidJWT" } };
    const report = await verifyProbeStorage(
      b,
      runId,
      async () => new Response(pixel),
    );
    expect(report.deleted).toBe(false);
  });
});
