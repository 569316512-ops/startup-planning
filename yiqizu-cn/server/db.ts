type Result = { data: unknown; error: unknown };
export type RpcClient = {
  rpc: (name: string, params: Record<string, unknown>) => PromiseLike<Result>;
};
export async function takeProbeSlot(
  db: RpcClient,
  runId: string,
): Promise<boolean> {
  const r = await db.rpc("cn_probe_take_slot_v2", { p_run_id: runId });
  if (
    r.error ||
    !r.data ||
    typeof r.data !== "object" ||
    !("taken" in r.data) ||
    typeof r.data.taken !== "boolean"
  )
    throw new Error("RPC_UNAVAILABLE");
  return r.data.taken;
}
