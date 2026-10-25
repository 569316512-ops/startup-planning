import { it, expect } from "vitest";
import { readyPort } from "../server/ready-port";

it("waits_for_credentials_and_shares_one_initialization", async () => {
  let release!: () => void,
    started = 0;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const get = readyPort(async () => {
    started++;
    await wait;
    return { name: "private-bucket" };
  });
  let resolved = false;
  const first = get().then((x) => {
    resolved = true;
    return x;
  });
  const second = get();
  await Promise.resolve();
  expect(resolved).toBe(false);
  release();
  expect(await first).toEqual({ name: "private-bucket" });
  expect(await second).toEqual(await first);
  expect(started).toBe(1);
});
it("fails_closed_on_bad_credentials_and_can_initialize_on_a_later_request", async () => {
  let attempts = 0;
  const get = readyPort(async () => {
    if (++attempts === 1) throw new Error("CREDENTIALS_UNAVAILABLE");
    return "ready";
  });
  await expect(get()).rejects.toThrow("CREDENTIALS_UNAVAILABLE");
  expect(await get()).toBe("ready");
});
