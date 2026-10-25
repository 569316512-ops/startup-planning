import { CITY_CONFIG } from "./cities";
import type {
  Gender,
  Housing,
  HousingState,
  LeadInput,
} from "./business-contracts";
export class InputError extends Error {
  readonly status = 400;
  constructor(public field: string) {
    super(`请检查填写内容：${field}`);
  }
}
export function ensure(value: unknown, field: string): asserts value {
  if (!value) throw new InputError(field);
}
export function object(value: unknown): Record<string, unknown> {
  ensure(value && typeof value === "object" && !Array.isArray(value), "表单");
  return value as Record<string, unknown>;
}
export function text(
  value: unknown,
  field: string,
  min = 0,
  max = 500,
): string {
  ensure(typeof value === "string", field);
  const s = value.trim();
  ensure(s.length >= min && s.length <= max, field);
  return s;
}
export function integer(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number {
  ensure(
    typeof value === "number" &&
      Number.isInteger(value) &&
      value >= min &&
      value <= max,
    field,
  );
  return value;
}
export function choice<T extends string>(
  value: unknown,
  options: readonly T[],
  field: string,
): T {
  ensure(typeof value === "string" && options.includes(value as T), field);
  return value as T;
}
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const SOURCES = [
  "direct",
  "xiaohongshu",
  "douyin",
  "wechat",
  "friend",
  "other",
  "test",
] as const;
export function shanghaiDay(now: Date): string {
  return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}
// Adapted from tongzhu-web/lib/pilot-retention.ts (v31).
export function retentionCutoff(now: Date): string {
  const d = new Date(now.getTime() + 8 * 3600000),
    day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 6);
  d.setUTCDate(
    Math.min(
      day,
      new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
      ).getUTCDate(),
    ),
  );
  return new Date(d.getTime() - 8 * 3600000).toISOString();
}
export function validateLead(input: unknown): LeadInput {
  const b = object(input),
    kind = choice(b.kind, ["room", "seeker"], "帖子类型");
  const city = text(b.city, "城市", 1, 10);
  ensure(Object.hasOwn(CITY_CONFIG, city), "城市");
  const district = text(b.district, "片区", 1, 20);
  ensure(CITY_CONFIG[city].districts.includes(district), "片区");
  const budget = integer(b.budget, "月租/预算", 1, 50000),
    minLeaseMonths = integer(b.minLeaseMonths, "租期", 1, 60);
  let housing: Housing | null = null;
  if (kind === "room") {
    const h = object(b.housing),
      housingState = choice<HousingState>(
        h.housingState,
        ["rented", "teamup", "landlord", "agent"],
        "房源状态",
      );
    const business = housingState === "landlord" || housingState === "agent";
    ensure(!business || h.authorityConfirmed === true, "发布权限确认");
    const bedrooms = integer(h.bedrooms, "卧室", 2, 3) as 2 | 3;
    ensure(
      typeof h.area === "number" &&
        Number.isFinite(h.area) &&
        h.area >= 1 &&
        h.area <= 1000,
      "面积",
    );
    ensure(h.originalLayout === true, "原始户型");
    ensure(
      Array.isArray(h.amenities) &&
        h.amenities.length >= 1 &&
        h.amenities.length <= 30,
      "设施",
    );
    const amenities = [
      ...new Set(h.amenities.map((v) => text(v, "设施标签", 1, 20))),
    ];
    housing = {
      housingState,
      community: text(h.community, "小区", 2, 80),
      bedrooms,
      bathrooms: integer(h.bathrooms, "卫生间", 1, 3),
      area: h.area,
      roomsAvailable: integer(h.roomsAvailable, "合租卧室", 1, bedrooms),
      originalLayout: true,
      amenities,
      authorityConfirmed: business,
    };
  }
  const business =
    housing?.housingState === "landlord" || housing?.housingState === "agent";
  ensure(b.adult === true, "年满18岁");
  ensure(b.consent === true, "联系方式使用范围");
  ensure(b.publicConsent === true, "公开展示范围");
  const contactType = choice(
      b.contactType,
      ["wechat", "phone"],
      "联系方式类型",
    ),
    contact = text(b.contact, "联系方式", 1, 40);
  ensure(
    contactType === "phone"
      ? /^1[3-9]\d{9}$/.test(contact)
      : /^[a-zA-Z][a-zA-Z0-9_-]{5,19}$/.test(contact),
    "联系方式",
  );
  ensure(Array.isArray(b.photoIds) && b.photoIds.length <= 12, "照片");
  const photoIds = b.photoIds.map((v) => {
    ensure(typeof v === "string" && UUID.test(v), "照片ID");
    return v;
  });
  ensure(new Set(photoIds).size === photoIds.length, "重复照片");
  const avatarUploadId = b.avatarUploadId ?? null;
  ensure(
    avatarUploadId === null ||
      (typeof avatarUploadId === "string" && UUID.test(avatarUploadId)),
    "头像ID",
  );
  return {
    kind,
    city,
    district,
    budget,
    minLeaseMonths,
    title: text(b.title, "标题", 2, 80),
    moveIn: text(b.moveIn, "起租时间", 1, 40),
    preferredGender: choice(
      b.preferredGender,
      ["男", "女", "不限"],
      "性别要求",
    ),
    gender: choice<Gender>(b.gender, ["男", "女", "其他", "不透露"], "性别"),
    nickname: text(b.nickname, "称呼", 1, 30),
    occupation: text(
      b.occupation ?? "",
      "职业",
      kind === "room" && !business ? 1 : 0,
      40,
    ),
    note: text(b.note, "房屋/求租描述", 4, 500),
    coRentalRules:
      kind === "room"
        ? text(b.coRentalRules ?? "", "合租要求", business ? 0 : 4, 500)
        : "",
    roommateExpectations: business
      ? ""
      : text(b.roommateExpectations, "室友期待", 4, 500),
    housing,
    photoIds,
    avatarUploadId,
    contactType,
    contact,
    contactVisibility: choice(
      b.contactVisibility,
      ["operator", "members"],
      "联系范围",
    ),
    adult: true,
    consent: true,
    publicConsent: true,
    source: choice(b.source ?? "direct", SOURCES, "来源"),
  };
}
