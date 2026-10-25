import type { Actor } from "../shared/contracts";
import type {
  ListingQuery,
  Page,
  PrivateLead,
  PublicLead,
} from "../shared/business-contracts";
import { validateLead, ensure, UUID, choice, integer } from "../shared/rules";
import { hashToken } from "./auth";
import type { Database } from "./database";
type Saved = { id: string; version: number };
function id(value: string) {
  ensure(typeof value === "string" && UUID.test(value), "帖子标识");
  return value;
}
function cursor(value?: string): { time: string; id: string } | null {
  if (!value) return null;
  ensure(value.length <= 256, "分页标识");
  try {
    const x = JSON.parse(Buffer.from(value, "base64url").toString());
    ensure(
      typeof x.time === "string" && Number.isFinite(Date.parse(x.time)),
      "分页时间",
    );
    id(x.id);
    return { time: x.time, id: x.id };
  } catch {
    ensure(false, "分页标识");
  }
}
export class LeadService {
  constructor(private db: Database) {}
  create(actor: Actor, input: unknown, requestId: string): Promise<Saved> {
    const lead = validateLead(input);
    id(requestId);
    return this.db.call("cn_create_lead", {
      p_user_id: actor.userId,
      p_input: lead,
      p_request_id: requestId,
      p_payload_hash: hashToken(JSON.stringify(lead)),
    });
  }
  update(
    actor: Actor,
    leadId: string,
    input: unknown,
    expectedVersion: number,
  ): Promise<Saved> {
    return this.db.call("cn_update_lead", {
      p_user_id: actor.userId,
      p_id: id(leadId),
      p_input: validateLead(input),
      p_version: integer(expectedVersion, "版本", 1, 2147483646),
    });
  }
  async withdraw(actor: Actor, leadId: string) {
    await this.db.call("cn_withdraw_lead", {
      p_user_id: actor.userId,
      p_id: id(leadId),
    });
  }
  get(leadId: string, actor: Actor | null): Promise<PublicLead> {
    return this.db.call("cn_get_lead", {
      p_id: id(leadId),
      p_user_id: actor?.userId ?? null,
      p_owned: false,
    });
  }
  getOwned(actor: Actor, leadId: string): Promise<PrivateLead> {
    return this.db.call("cn_get_lead", {
      p_id: id(leadId),
      p_user_id: actor.userId,
      p_owned: true,
    });
  }
  contact(
    actor: Actor,
    leadId: string,
  ): Promise<{ type: "phone" | "wechat"; value: string; remaining: number }> {
    return this.db.call("cn_get_contact", {
      p_user_id: actor.userId,
      p_id: id(leadId),
    });
  }
  async list(
    query: ListingQuery,
    actor: Actor | null,
  ): Promise<Page<PublicLead>> {
    const c = cursor(query.cursor),
      limit =
        query.limit === undefined
          ? 24
          : integer(query.limit, "每页条数", 1, 24);
    if (query.mine) ensure(actor, "请先登录");
    if (query.kind) choice(query.kind, ["room", "seeker"], "类型");
    const filter: Record<string, unknown> = {};
    for (const k of ["city", "district"] as const)
      if (query[k]) {
        ensure(typeof query[k] === "string" && query[k]!.length <= 20, k);
        filter[k] = query[k];
      }
    for (const k of ["minPrice", "maxPrice"] as const)
      if (query[k] !== undefined) filter[k] = integer(query[k], k, 0, 50000);
    if (query.kind) filter.kind = query.kind;
    if (query.bedrooms !== undefined)
      filter.bedrooms = integer(query.bedrooms, "卧室", 2, 3);
    if (query.amenities) {
      ensure(
        Array.isArray(query.amenities) &&
          query.amenities.length <= 30 &&
          query.amenities.every((x) => typeof x === "string" && x.length <= 20),
        "设施",
      );
      filter.amenities = query.amenities;
    }
    const result = await this.db.call<{ items: PublicLead[] }>(
      "cn_list_leads",
      {
        p_user_id: actor?.userId ?? null,
        p_mine: query.mine === true,
        p_filter: filter,
        p_cursor_time: c?.time ?? null,
        p_cursor_id: c?.id ?? null,
        p_limit: limit + 1,
      },
    );
    const more = result.items.length > limit,
      items = result.items.slice(0, limit),
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
}
