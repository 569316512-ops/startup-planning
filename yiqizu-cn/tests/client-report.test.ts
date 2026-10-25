import { it, expect } from "vitest";
import {
  permissionDenied,
  signedUploadDenied,
  postgresDeniedResponse,
  publicReport,
} from "../probe/report";
it("recognizes_actual_permissions_not_network_or_missing_tables", () => {
  expect(permissionDenied({ code: "42501" })).toBe(true);
  expect(permissionDenied({ status: 403, error: "Forbidden" })).toBe(true);
  for (const e of [
    null,
    { status: 403 },
    { status: 401 },
    { status: 404 },
    { code: "PGRST205" },
    new Error("network error"),
  ])
    expect(permissionDenied(e)).toBe(false);
});
it("does_not_treat_signed_upload_network_failure_as_permission_proof", () => {
  expect(signedUploadDenied({ status: 409, error: "Duplicate" })).toBe(true);
  expect(
    signedUploadDenied({ status: 403, code: "SignatureDoesNotMatch" }),
  ).toBe(true);
  expect(signedUploadDenied({ status: 409 })).toBe(false);
  for (const code of [
    "ExpiredToken",
    "InvalidJWT",
    "InvalidRequest",
    "BadRequest",
  ])
    expect(signedUploadDenied({ status: 400, code })).toBe(false);
  expect(signedUploadDenied(new Error("network failure"))).toBe(false);
  expect(signedUploadDenied({ status: 503 })).toBe(false);
});
it("rejects_gateway_html_403_and_expired_token_as_pg_permission_proof", async () => {
  expect(
    await postgresDeniedResponse(
      new Response("<html>Denied</html>", {
        status: 403,
        headers: { "Content-Type": "text/html" },
      }),
    ),
  ).toBe(false);
  expect(
    await postgresDeniedResponse(
      Response.json({ code: "PGRST303", message: "expired" }, { status: 401 }),
    ),
  ).toBe(false);
  expect(
    await postgresDeniedResponse(
      Response.json(
        { code: "42501", message: "permission denied" },
        { status: 403 },
      ),
    ),
  ).toBe(true);
});
it("exports_allowlisted_report_fields_only", () => {
  const r = publicReport({
    runId: "test",
    checks: { sdk: "passed" },
    requestIds: ["safe-id"],
    token: "secret",
    url: "https://private.invalid/?token=private",
  });
  expect(r.checks.sdk).toBe("passed");
  expect(r.overall).toBe("manual-verification-required");
  expect(JSON.stringify(r)).not.toMatch(/secret|https|token/);
});
