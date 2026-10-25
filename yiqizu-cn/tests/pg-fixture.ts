import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
export const pgConfigured = Boolean(process.env.TEST_DATABASE_URL);
function args() {
  const u = new URL(process.env.TEST_DATABASE_URL ?? "");
  if (
    u.protocol !== "docker:" ||
    !/^yiqizu-probe-pg-\d+$/.test(u.hostname) ||
    !/^\/yiqizu_test_[a-z_]+$/.test(u.pathname)
  )
    throw new Error(
      "Explicit isolated TEST_DATABASE_URL=docker://yiqizu-probe-pg-<date>/yiqizu_test_<name> required",
    );
  return [
    "--host=unix:///var/run/docker.sock",
    "exec",
    "-i",
    u.hostname,
    "psql",
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-v",
    "VERBOSITY=verbose",
    "-U",
    "postgres",
    "-d",
    u.pathname.slice(1),
    "-A",
    "-t",
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
export function sql(query: string): string {
  return execFileSync("docker", args(), {
    env,
    input: query,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}
export async function sqlAsync(query: string): Promise<string> {
  const p = run("docker", [...args(), "-c", query], { env });
  return (await p).stdout.trim();
}
export function literal(s: string) {
  return "'" + s.replaceAll("'", "''") + "'";
}
export function failure(query: string) {
  try {
    sql(query);
    return "";
  } catch (e) {
    return String((e as { stderr: unknown }).stderr);
  }
}
