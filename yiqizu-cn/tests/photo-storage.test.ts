import { it, expect } from "vitest";
import { photoStorage } from "../server/photo-storage";
import type { ProbeStorageBucket } from "../server/storage";
it("cleanup_retry_accepts_explicit_already_missing_object_but_not_invalid_credentials", async () => {
  const missing = {
    info: async () => ({
      data: null,
      error: { status: 404, code: "STORAGE_OBJECT_NOT_FOUND" },
    }),
    remove: async () => ({
      data: null,
      error: { status: 404, code: "STORAGE_OBJECT_NOT_FOUND" },
    }),
  } as unknown as ProbeStorageBucket;
  await expect(
    photoStorage(missing).remove("cn-photos/user/photo"),
  ).resolves.toBeUndefined();
  const invalid = {
    ...missing,
    info: async () => ({
      data: null,
      error: { status: 401, code: "ACCESS_TOKEN_INVALID" },
    }),
  };
  await expect(
    photoStorage(invalid).remove("cn-photos/user/photo"),
  ).rejects.toThrow();
});
