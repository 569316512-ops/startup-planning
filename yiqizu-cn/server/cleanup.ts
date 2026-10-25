import type { Database } from "./database";
import { integer } from "../shared/rules";
export class CleanupService {
  constructor(
    private db: Database,
    private storage: { remove(key: string): Promise<void> },
  ) {}
  async run(now: Date, limit: number) {
    integer(limit, "清理批量", 1, 25);
    const plan = await this.db.call<{
      hidden: number;
      items: { id: string; object_key: string }[];
    }>("cn_cleanup_prepare", { p_now: now.toISOString(), p_limit: limit });
    let deleted = 0,
      retry = 0;
    for (const item of plan.items) {
      try {
        await this.storage.remove(item.object_key);
        await this.db.call("cn_cleanup_done", { p_id: item.id });
        deleted++;
      } catch {
        retry++;
      }
    }
    return { hidden: plan.hidden, deleted, retry };
  }
}
