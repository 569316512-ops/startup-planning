import { ENV_ID } from "../shared/contracts";
import { domainError } from "./errors";
import { unwrapRpc, type Database } from "./database";
export function restDatabase(
  key: string,
  request: typeof fetch = fetch,
): Database {
  return {
    async call<T>(name: string, params: Record<string, unknown>): Promise<T> {
      if (!/^cn_[a-z_0-9]+$/.test(name)) domainError("INVALID_RPC");
      try {
        const r = await request(
          `https://${ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest/rpc/${name}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(params),
            redirect: "error",
            signal: AbortSignal.timeout(1800),
          },
        );
        if (
          !r.ok ||
          !r.headers.get("Content-Type")?.includes("application/json")
        )
          domainError("DATABASE_UNAVAILABLE");
        return unwrapRpc<T>(await r.json());
      } catch (e) {
        if (e instanceof Error && "status" in e) throw e;
        domainError("DATABASE_UNAVAILABLE");
      }
    },
  };
}
