import nodeSdk from "@cloudbase/node-sdk";
import { ENV_ID } from "../shared/contracts";
import { AuthService } from "./auth";
import { ProfileService } from "./profile";
import { LeadService } from "./leads";
import { UploadService, type StoragePort } from "./uploads";
import { OperationsService } from "./operations";
import { CleanupService } from "./cleanup";
import { photoStorage } from "./photo-storage";
import { readyPort } from "./ready-port";
import { restDatabase } from "./rest-database";
import { createRouter } from "./main";
function services() {
  const key = process.env.CLOUDBASE_APIKEY;
  if (!key || process.env.CLOUDBASE_ENV_ID !== ENV_ID)
    throw new Error("SERVER_NOT_CONFIGURED");
  const db = restDatabase(key);
  const getStorage = readyPort(async () => {
    const sdk = (await import("@cloudbase/js-sdk")).default;
    const app = sdk.init({
      env: ENV_ID,
      accessKey: key,
      persistence: "none",
      debug: false,
      timeout: 1800,
    });
    const c = await app.auth({ persistence: "none" }).getAccessToken();
    if (!c.accessToken) throw new Error("CREDENTIALS_UNAVAILABLE");
    return photoStorage(app.storage.from("cn-photos-private"));
  });
  const storage: StoragePort = {
    issueUpload: async (k, i) => (await getStorage()).issueUpload(k, i),
    inspect: async (k) => (await getStorage()).inspect(k),
    readUrl: async (k, s) => (await getStorage()).readUrl(k, s),
    remove: async (k) => (await getStorage()).remove(k),
  };
  return createRouter(
    new AuthService(db),
    new ProfileService(db),
    new LeadService(db),
    {
      uploads: new UploadService(db, storage),
      ops: new OperationsService(db),
      cleanup: new CleanupService(db, storage),
    },
  );
}
let router: ReturnType<typeof services> | undefined;
export async function main(
  event: unknown,
  context?: Parameters<typeof nodeSdk.getCloudbaseContext>[0],
) {
  try {
    // Only the platform invocation context, never event headers/context/owner claims.
    const trusted = nodeSdk.getCloudbaseContext(context),
      identity = trusted.TCB_UUID ?? trusted.TCB_SOURCE_IP ?? "";
    return await (router ??= services())(event, identity);
  } catch {
    return {
      ok: false,
      error: {
        status: 503,
        code: "UNAVAILABLE",
        message: "服务暂时不可用，请稍后再试",
      },
      requestId: "server-unavailable",
    };
  }
}
