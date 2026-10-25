import {
  CONTRACT_VERSION,
  ENV_ID,
  type ApiRequest,
  type UploadGrant,
} from "../shared/contracts";
import { session as appSession } from "./session";
export type Api = <T>(
  action: string,
  payload: unknown,
  options?: { requestId?: string; signal?: AbortSignal },
) => Promise<T>;
export class ClientError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function createApi(
  transport: (req: ApiRequest) => Promise<unknown>,
  session: Pick<typeof appSession, "get" | "clear">,
): Api {
  return async <T>(
    action: string,
    payload: unknown,
    options: { requestId?: string; signal?: AbortSignal } = {},
  ) => {
    if (options.signal?.aborted) throw new ClientError(0, "请求已取消");
    let raw: unknown;
    try {
      raw = await transport({
        version: CONTRACT_VERSION,
        action,
        payload,
        requestId: options.requestId ?? crypto.randomUUID(),
        ...(session.get() ? { sessionToken: session.get()! } : {}),
      });
    } catch {
      throw new ClientError(503, "服务暂时不可用，请稍后重试");
    }
    if (
      !raw ||
      typeof raw !== "object" ||
      !("ok" in raw) ||
      !("requestId" in raw) ||
      typeof raw.requestId !== "string"
    )
      throw new ClientError(503, "服务暂时不可用，请稍后重试");
    const r = raw as Record<string, unknown>;
    if (r.ok === false) {
      const e = r.error;
      if (
        !e ||
        typeof e !== "object" ||
        !("status" in e) ||
        typeof e.status !== "number" ||
        !("message" in e) ||
        typeof e.message !== "string"
      )
        throw new ClientError(503, "服务暂时不可用，请稍后重试");
      if (e.status === 401) session.clear();
      throw new ClientError(e.status, e.message);
    }
    if (r.ok !== true || !Object.hasOwn(r, "data"))
      throw new ClientError(503, "服务暂时不可用，请稍后重试");
    return r.data as T;
  };
}
let connecting:
  | Promise<ReturnType<(typeof import("@cloudbase/js-sdk"))["init"]>>
  | undefined;
async function app() {
  return (connecting ??= (async () => {
    const sdk = (await import("@cloudbase/js-sdk")).default;
    const a = sdk.init({ env: ENV_ID, persistence: "none" });
    const r = await a.auth({ persistence: "none" }).signInAnonymously();
    if (r.error) throw new Error("TRANSPORT_LOGIN_FAILED");
    return a;
  })().catch((e) => {
    connecting = undefined;
    throw e;
  }));
}
export const api = createApi(
  async (req) =>
    (await (await app()).callFunction({ name: "yiqizu-api", data: req }))
      .result,
  appSession,
);
export async function uploadPhoto(file: File): Promise<string> {
  const a = await app(),
    { uploadId, grant } = await api<{ uploadId: string; grant: UploadGrant }>(
      "uploads.begin",
      { type: file.type, size: file.size },
    );
  const r = await a.storage
    .from("cn-photos-private")
    .uploadToSignedUrl(grant.path, grant.token, file, {
      contentType: file.type,
      upsert: false,
    });
  if (r.error) throw new ClientError(503, "照片上传失败，请重试");
  await api("uploads.finalize", { uploadId });
  return uploadId;
}
