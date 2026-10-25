import type { ProbeStorageBucket } from "./storage";
import type { StoragePort } from "./uploads";
import { objectNotFound } from "../shared/provider-errors";
export function photoStorage(bucket: ProbeStorageBucket): StoragePort {
  return {
    async issueUpload(path) {
      const r = await bucket.createSignedUploadUrl(path, { upsert: false });
      if (
        r.error ||
        !r.data ||
        r.data.path !== path ||
        !r.data.fullSignedURL.startsWith("https://")
      )
        throw new Error("UPLOAD_SIGNING_UNAVAILABLE");
      return { path, token: r.data.token, url: r.data.fullSignedURL };
    },
    async inspect(path) {
      const info = await bucket.info(path);
      if (
        info.error ||
        !info.data ||
        !info.data.size ||
        info.data.size > 5242880
      )
        throw new Error("INVALID_PHOTO_METADATA");
      const content = await bucket.download(path);
      if (
        content.error ||
        !content.data ||
        content.data.size !== info.data.size
      )
        throw new Error("PHOTO_READ_FAILED");
      return {
        size: content.data.size,
        type: info.data.contentType ?? "",
        header: new Uint8Array(await content.data.slice(0, 16).arrayBuffer()),
      };
    },
    async readUrl(path, seconds) {
      const r = await bucket.createSignedUrl(path, Math.min(seconds, 300));
      if (r.error || !r.data || !r.data.fullSignedURL.startsWith("https://"))
        throw new Error("PHOTO_SIGNING_UNAVAILABLE");
      return r.data.fullSignedURL;
    },
    async remove(path) {
      const before = await bucket.info(path);
      if (before.data === null && objectNotFound(before.error)) return;
      if (before.error) throw new Error("PHOTO_METADATA_UNAVAILABLE");
      const r = await bucket.remove([path]);
      if (r.error) throw new Error("PHOTO_DELETE_FAILED");
      const info = await bucket.info(path);
      if (info.data !== null || !objectNotFound(info.error))
        throw new Error("PHOTO_DELETE_UNCONFIRMED");
    },
  };
}
