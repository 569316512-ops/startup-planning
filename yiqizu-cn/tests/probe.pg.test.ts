import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
const container = process.env.CN_PROBE_PG_CONTAINER;
const invoke = promisify(execFile);
function command(sql: string) {
  if (!container || !/^yiqizu-probe-pg-[0-9]+$/.test(container))
    throw new Error("Dedicated local probe container required");
  return [
    "--host=unix:///var/run/docker.sock",
    "exec",
    container,
    "psql",
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-v",
    "VERBOSITY=verbose",
    "-U",
    "postgres",
    "-d",
    "yiqizu_test_probe",
    "-A",
    "-t",
    "-c",
    sql,
  ];
}
const env = { ...process.env };
for (const k of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[k];
function sql(query: string) {
  return execFileSync("docker", command(query), {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}
describe.skipIf(!container)("real isolated PostgreSQL probe", () => {
  it("v2_returns_json_and_serializes_the_concurrent_last_slot", async () => {
    const id = randomUUID(),
      q = `SET ROLE service_role; SELECT public.cn_probe_take_slot_v2('${id}'::uuid);`;
    const results = await Promise.all([
      invoke("docker", command(q), { env }),
      invoke("docker", command(q), { env }),
    ]);
    expect(
      results
        .map((r) => JSON.parse(r.stdout.trim().split("\n").at(-1)!).taken)
        .sort(),
    ).toEqual([false, true]);
  });
  it.each(["anon", "authenticated"])("denies_%s_v2_rpc_execution", (role) => {
    let state = "";
    try {
      sql(
        `SET ROLE ${role}; SELECT public.cn_probe_take_slot_v2('${randomUUID()}'::uuid);`,
      );
    } catch (e) {
      state = String((e as { stderr: unknown }).stderr);
    }
    expect(state).toContain("42501");
  });
  it("allows_exactly_one_concurrent_last_slot", async () => {
    const id = randomUUID(),
      q = `SET ROLE service_role; SELECT public.cn_probe_take_slot('${id}'::uuid);`;
    const results = await Promise.all([
      invoke("docker", command(q), { env }),
      invoke("docker", command(q), { env }),
    ]);
    expect(
      results.map((r) => r.stdout.trim().split("\n").at(-1)).sort(),
    ).toEqual(["f", "t"]);
  });
  it.each(["anon", "authenticated"])(
    "denies_%s_direct_table_access",
    (role) => {
      let state = "";
      try {
        sql(
          `SET ROLE ${role}; SELECT run_id FROM public.cn_probe_slots LIMIT 1;`,
        );
      } catch (e) {
        state = String((e as { stderr: unknown }).stderr);
      }
      expect(state).toContain("42501");
    },
  );
  it.each(["anon", "authenticated"])(
    "denies_%s_direct_rpc_execution",
    (role) => {
      let state = "";
      try {
        sql(
          `SET ROLE ${role}; SELECT public.cn_probe_take_slot('${randomUUID()}'::uuid);`,
        );
      } catch (e) {
        state = String((e as { stderr: unknown }).stderr);
      }
      expect(state).toContain("42501");
    },
  );
  it("service_role_can_only_insert_one_row_for_same_run", () => {
    const id = randomUUID();
    sql(
      `SET ROLE service_role; SELECT public.cn_probe_take_slot('${id}'); SELECT public.cn_probe_take_slot('${id}');`,
    );
    expect(
      sql(
        `SET ROLE service_role; SELECT count(*) FROM public.cn_probe_slots WHERE run_id='${id}';`,
      )
        .trim()
        .split("\n")
        .at(-1),
    ).toBe("1");
  });
});
