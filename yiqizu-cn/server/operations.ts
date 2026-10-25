import type { Actor } from "../shared/contracts";
import type { Database } from "./database";
import type {
  Page,
  PrivateLead,
  FollowupStatus,
} from "../shared/business-contracts";
import { object, text, choice, UUID, SOURCES, ensure } from "../shared/rules";
import { ApiError } from "./errors";
import { hashToken } from "./auth";
export type FeedbackRecord = {
  id: string;
  category: "bug" | "privacy" | "report";
  content: string;
  contact: string;
  post_id: string | null;
  status: "new" | "resolved";
  created_at: string;
};
function admin(actor: Actor) {
  if (actor.role !== "admin")
    throw new ApiError(403, "FORBIDDEN", "没有运营权限");
}
function after(cursor?: string) {
  if (!cursor) return { time: null, id: null };
  ensure(cursor.length <= 256, "分页");
  try {
    const c = JSON.parse(Buffer.from(cursor, "base64url").toString());
    ensure(
      typeof c.time === "string" &&
        Number.isFinite(Date.parse(c.time)) &&
        typeof c.id === "string" &&
        UUID.test(c.id),
      "分页",
    );
    return c;
  } catch {
    ensure(false, "分页");
  }
}
export class OperationsService {
  constructor(private db: Database) {}
  async list(actor: Actor, cursor?: string): Promise<Page<PrivateLead>> {
    admin(actor);
    const c = after(cursor),
      r = await this.db.call<{ items: PrivateLead[] }>("cn_operations_list", {
        p_user_id: actor.userId,
        p_cursor_time: c.time,
        p_cursor_id: c.id,
      });
    const more = r.items.length > 200,
      items = r.items.slice(0, 200),
      last = items.at(-1);
    return {
      items,
      nextCursor:
        more && last
          ? Buffer.from(
              JSON.stringify({ time: last.createdAt, id: last.id }),
            ).toString("base64url")
          : null,
    };
  }
  async followup(actor: Actor, id: string, status: FollowupStatus) {
    admin(actor);
    ensure(UUID.test(id), "帖子");
    await this.db.call("cn_operations_update", {
      p_user_id: actor.userId,
      p_id: id,
      p_followup: choice(
        status,
        ["new", "qualified", "contacted", "viewing", "matched", "invalid"],
        "跟进状态",
      ),
      p_visibility: null,
    });
  }
  async moderate(actor: Actor, id: string, visibility: "active" | "hidden") {
    admin(actor);
    ensure(UUID.test(id), "帖子");
    await this.db.call("cn_operations_update", {
      p_user_id: actor.userId,
      p_id: id,
      p_followup: null,
      p_visibility: choice(visibility, ["active", "hidden"], "公开状态"),
    });
  }
  async feedback(input: unknown, identity: string): Promise<{ id: string }> {
    if (!identity)
      throw new ApiError(503, "IDENTITY_UNAVAILABLE", "服务暂时不可用");
    const p = object(input);
    if (p.postId)
      ensure(typeof p.postId === "string" && UUID.test(p.postId), "帖子");
    return this.db.call("cn_feedback_submit", {
      p_category: choice(p.category, ["bug", "privacy", "report"], "反馈类型"),
      p_content: text(p.content, "内容", 4, 2000),
      p_contact: text(p.contact ?? "", "回复方式", 0, 100),
      p_post_id: p.postId ?? null,
      p_source_hash: hashToken("feedback:" + identity),
    });
  }
  async feedbackList(
    actor: Actor,
    cursor?: string,
  ): Promise<Page<FeedbackRecord>> {
    admin(actor);
    const c = after(cursor),
      r = await this.db.call<{ items: FeedbackRecord[] }>("cn_feedback_list", {
        p_user_id: actor.userId,
        p_cursor_time: c.time,
        p_cursor_id: c.id,
      }),
      more = r.items.length > 200,
      items = r.items.slice(0, 200),
      last = items.at(-1);
    return {
      items,
      nextCursor:
        more && last
          ? Buffer.from(
              JSON.stringify({ time: last.created_at, id: last.id }),
            ).toString("base64url")
          : null,
    };
  }
  async resolveFeedback(actor: Actor, id: string) {
    admin(actor);
    ensure(UUID.test(id), "反馈");
    await this.db.call("cn_feedback_resolve", {
      p_user_id: actor.userId,
      p_id: id,
    });
  }
  async event(input: unknown, identity: string) {
    if (!identity)
      throw new ApiError(503, "IDENTITY_UNAVAILABLE", "服务暂时不可用");
    const p = object(input);
    ensure(
      typeof p.eventId === "string" &&
        UUID.test(p.eventId) &&
        typeof p.sessionId === "string" &&
        UUID.test(p.sessionId),
      "访问标识",
    );
    await this.db.call("cn_record_event", {
      p_event: choice(
        p.event,
        ["visit", "quick_open", "detail_open", "contact_click"],
        "事件",
      ),
      p_event_id: p.eventId,
      p_session_id: p.sessionId,
      p_city: text(p.city, "城市", 1, 10),
      p_source: choice(p.source, SOURCES, "来源"),
      p_source_hash: hashToken("events:" + identity),
    });
  }
  async metrics(
    actor: Actor,
  ): Promise<{
    events: { event: string; sessions: number }[];
    registrations: { source: string; status: string; count: number }[];
  }> {
    admin(actor);
    return this.db.call("cn_metrics", { p_user_id: actor.userId });
  }
}
