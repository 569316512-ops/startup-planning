import { it, expect } from "vitest";
import cloudbase from "@cloudbase/js-sdk";
import { attemptProbeOverwrite } from "../probe/overwrite";
import { ENV_ID, PROBE_BUCKET } from "../shared/contracts";
it("sends_a_real_overwrite_header_through_the_pinned_sdk", async () => {
  const b = cloudbase
    .init({ env: ENV_ID, persistence: "none" })
    .storage.from(PROBE_BUCKET);
  // Intercept only the external transport; run the installed SDK's real upload implementation.
  let headers: Record<string, string> = {};
  const internal = b as unknown as {
    http: {
      send: (r: { headers: Record<string, string> }) => Promise<unknown>;
    };
  };
  internal.http.send = async (r) => {
    headers = r.headers;
    return { Key: "cn-probe/run/pixel.png" };
  };
  await attemptProbeOverwrite(
    b,
    "cn-probe/run/pixel.png",
    "test-signed-token",
    new Blob(["changed"], { type: "image/png" }),
  );
  expect(headers["x-upsert"]).toBe("true");
});
