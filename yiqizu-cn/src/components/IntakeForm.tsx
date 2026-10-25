import { useState, useEffect, useRef } from "react";
import type { Kind } from "../../shared/contracts";
import type {
  LeadDraft,
  Profile,
  PrivateLead,
} from "../../shared/business-contracts";
import { CITY_CONFIG, CITIES } from "../../shared/cities";
import { validateLead, SOURCES } from "../../shared/rules";
import { fillProfileDefaults } from "../../shared/profile-prefill";
import {
  draftKey,
  loadDraft,
  saveDraft,
  clearDraft,
  mergeDraft,
} from "../drafts";
import { api, type Api, uploadPhoto } from "../client";
import { PhotoPicker } from "./PhotoPicker";
const tags = [
  "家具齐全",
  "洗衣机",
  "冰箱",
  "空调",
  "热水器",
  "可做饭",
  "燃气",
  "阳台",
  "宽带",
  "衣柜",
  "书桌",
  "沙发",
  "电视",
  "近地铁",
  "停车位",
  "门禁",
  "接受宠物",
];
export function IntakeForm({
  kind,
  city,
  profile,
  editing = null,
  onLogin,
  onDone,
  call = api,
  upload = uploadPhoto,
}: {
  kind: Kind;
  city: string;
  profile: Profile | null;
  editing?: PrivateLead | null;
  onLogin: () => void;
  onDone: (id: string) => void;
  call?: Api;
  upload?: (file: File) => Promise<string>;
}) {
  const key = draftKey(profile?.id ?? null, kind),
    saved = useRef(editing ? null : loadDraft(key)),
    touched = useRef(new Set(saved.current?.touched ?? [])),
    requestId = useRef(saved.current?.requestId ?? crypto.randomUUID()),
    locked = useRef(false),
    completed = useRef(false);
  const [form, setForm] = useState<LeadDraft>(() =>
    mergeDraft({
      current: {
        kind,
        city,
        contactType: "wechat",
        preferredGender: "不限",
        gender: "不透露",
        photoIds: [],
        housing:
          kind === "room"
            ? {
                housingState: "rented",
                bedrooms: 2,
                bathrooms: 1,
                roomsAvailable: 1,
                amenities: [],
                originalLayout: false,
              }
            : undefined,
        source: SOURCES.includes(
          new URLSearchParams(location.search).get(
            "source",
          ) as (typeof SOURCES)[number],
        )
          ? new URLSearchParams(location.search).get("source")!
          : "direct",
      },
      profile,
      draft: saved.current?.data ?? null,
      editing,
      touched: touched.current,
    }),
  );
  const [uploadBusy, setUploadBusy] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [custom, setCustom] = useState("");
  const [draftOwner, setDraftOwner] = useState(profile?.id ?? null);
  useEffect(() => {
    const nextOwner = profile?.id ?? null;
    if (draftOwner && draftOwner !== nextOwner) {
      const next = nextOwner ? loadDraft(draftKey(nextOwner, kind)) : null;
      touched.current = new Set(next?.touched ?? []);
      requestId.current = next?.requestId ?? crypto.randomUUID();
      setForm(
        mergeDraft({
          current: {
            kind,
            city,
            photoIds: [],
            gender: "不透露",
            preferredGender: "不限",
            contactType: "wechat",
          },
          profile,
          draft: next?.data ?? null,
          editing,
          touched: touched.current,
        }),
      );
    } else if (!editing)
      setForm((f) => fillProfileDefaults(f, profile, touched.current));
    setDraftOwner(nextOwner);
  }, [profile, editing, draftOwner, kind, city]);
  useEffect(() => {
    if (!editing && !completed.current && draftOwner === (profile?.id ?? null))
      saveDraft(key, {
        data: form,
        touched: [...touched.current],
        requestId: requestId.current,
      });
  }, [key, form, editing, draftOwner, profile?.id]);
  function set<K extends keyof LeadDraft>(name: K, value: LeadDraft[K]) {
    touched.current.add(name);
    setForm((f) => ({ ...f, [name]: value }));
  }
  function house(name: string, value: unknown) {
    touched.current.add("housing");
    setForm((f) => ({ ...f, housing: { ...f.housing, [name]: value } }));
  }
  const h = form.housing,
    business = h?.housingState === "landlord" || h?.housingState === "agent";
  const field = (
    name: "title" | "moveIn" | "nickname" | "occupation",
    label: string,
    max = 40,
    required = true,
  ) => (
    <label>
      {label}
      <input
        required={required}
        maxLength={max}
        value={form[name] ?? ""}
        onChange={(e) => set(name, e.target.value)}
      />
    </label>
  );
  async function submit() {
    if (locked.current || uploadBusy) return;
    if (!profile) {
      setMessage("请先登录，已填写内容会保留。");
      onLogin();
      return;
    }
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      const input = validateLead({
        ...form,
        budget: Number(form.budget),
        minLeaseMonths: Number(form.minLeaseMonths),
        housing: kind === "room" ? form.housing : null,
      });
      const p = editing
        ? await call<{ id: string }>("leads.update", {
            id: editing.id,
            input,
            expectedVersion: editing.version,
          })
        : await call<{ id: string }>("leads.create", input, {
            requestId: requestId.current,
          });
      completed.current = true;
      clearDraft(key);
      if (!editing) clearDraft(draftKey(null, kind));
      onDone(p.id);
    } catch (e) {
      const err = e as Error & { status?: number };
      setMessage(
        err.status === 409
          ? "帖子或发布状态已变化，填写内容已保留。请先在“我的帖子”核对，再重新打开编辑。"
          : err.message,
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="panel stack">
      <h1>
        {editing ? "修改帖子" : kind === "room" ? "有房找室友" : "登记求租需求"}
      </h1>
      <p className="note">
        {editing
          ? "修改不增加发帖次数。"
          : "每天可发布3帖。草稿保存在当前浏览器，可清除。"}
        个人介绍在“我的”填写。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {field("title", "标题", 80)}
        <div className="form-grid">
          <label>
            城市
            <select
              value={form.city}
              onChange={(e) => {
                set("city", e.target.value);
                set("district", "");
              }}
            >
              {CITIES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            片区
            <select
              required
              value={form.district ?? ""}
              onChange={(e) => set("district", e.target.value)}
            >
              <option value="">请选择片区</option>
              {CITY_CONFIG[form.city]?.districts.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        {kind === "room" && (
          <fieldset>
            <legend>房屋基本信息</legend>
            <label>
              房源状态
              <select
                value={h?.housingState ?? "rented"}
                onChange={(e) => house("housingState", e.target.value)}
              >
                <option value="rented">已租好，找室友</option>
                <option value="teamup">看好房，一起租</option>
                <option value="landlord">房东直租（自述）</option>
                <option value="agent">中介房源（自述）</option>
              </select>
            </label>
            <label>
              小区 / 公寓
              <input
                required
                maxLength={80}
                value={h?.community ?? ""}
                onChange={(e) => house("community", e.target.value)}
              />
            </label>
            <div className="form-grid">
              <label>
                原始户型
                <select
                  value={h?.bedrooms ?? 2}
                  onChange={(e) => house("bedrooms", Number(e.target.value))}
                >
                  <option value={2}>两室</option>
                  <option value={3}>三室</option>
                </select>
              </label>
              <label>
                卫生间
                <select
                  value={h?.bathrooms ?? 1}
                  onChange={(e) => house("bathrooms", Number(e.target.value))}
                >
                  {[1, 2, 3].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                整套面积（㎡）
                <input
                  required
                  type="number"
                  min={1}
                  max={1000}
                  step="0.1"
                  value={h?.area ?? ""}
                  onChange={(e) =>
                    house(
                      "area",
                      e.target.value ? Number(e.target.value) : undefined,
                    )
                  }
                />
              </label>
              <label>
                可合租卧室数量
                <input
                  required
                  type="number"
                  min={1}
                  max={h?.bedrooms ?? 2}
                  value={h?.roomsAvailable ?? 1}
                  onChange={(e) =>
                    house("roomsAvailable", Number(e.target.value))
                  }
                />
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                required
                checked={h?.originalLayout === true}
                onChange={(e) => house("originalLayout", e.target.checked)}
              />
              确认是无新增隔断的原始户型
            </label>
            {business && (
              <label className="check">
                <input
                  type="checkbox"
                  required
                  checked={h?.authorityConfirmed === true}
                  onChange={(e) =>
                    house("authorityConfirmed", e.target.checked)
                  }
                />
                我有权发布此房源并安排看房。身份为自述，未经平台核验。
              </label>
            )}
            <h3>房屋设施</h3>
            <div className="chips">
              {[...new Set([...tags, ...(h?.amenities ?? [])])].map((tag) => (
                <label className="check" key={tag}>
                  <input
                    type="checkbox"
                    checked={h?.amenities?.includes(tag) ?? false}
                    onChange={(e) =>
                      house(
                        "amenities",
                        e.target.checked
                          ? [...(h?.amenities ?? []), tag]
                          : (h?.amenities ?? []).filter((x) => x !== tag),
                      )
                    }
                  />
                  {tag}
                </label>
              ))}
            </div>
            <label>
              自定义设施标签
              <input
                value={custom}
                maxLength={20}
                onChange={(e) => setCustom(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                if (custom.trim()) {
                  house("amenities", [
                    ...new Set([...(h?.amenities ?? []), custom.trim()]),
                  ]);
                  setCustom("");
                }
              }}
            >
              添加标签
            </button>
          </fieldset>
        )}
        <div className="form-grid">
          <label>
            {kind === "seeker" ? "每月个人预算（元）" : "每人月租（元）"}
            <input
              required
              type="number"
              min={1}
              max={50000}
              value={form.budget ?? ""}
              onChange={(e) => set("budget", e.target.value)}
            />
          </label>
          {field("moveIn", kind === "room" ? "起租时间" : "大致入住时间")}
          <label>
            {kind === "seeker" ? "预计租多久（月）" : "几个月起租"}
            <input
              required
              type="number"
              min={1}
              max={60}
              step={1}
              value={form.minLeaseMonths ?? ""}
              onChange={(e) => set("minLeaseMonths", e.target.value)}
            />
          </label>
          <label>
            性别要求
            <select
              value={form.preferredGender ?? "不限"}
              onChange={(e) =>
                set(
                  "preferredGender",
                  e.target.value as LeadDraft["preferredGender"],
                )
              }
            >
              <option value="不限">不限</option>
              <option value="男">男生</option>
              <option value="女">女生</option>
            </select>
          </label>
        </div>
        <label>
          {kind === "room" ? "关于房子" : "我的求租需求"}
          <textarea
            required
            minLength={4}
            maxLength={500}
            value={form.note ?? ""}
            onChange={(e) => set("note", e.target.value)}
          />
        </label>
        {kind === "room" && (
          <label>
            合租要求
            <textarea
              required={!business}
              minLength={business ? 0 : 4}
              maxLength={500}
              value={form.coRentalRules ?? ""}
              onChange={(e) => set("coRentalRules", e.target.value)}
            />
          </label>
        )}
        {!business && (
          <label>
            室友期待
            <textarea
              required
              minLength={4}
              maxLength={500}
              value={form.roommateExpectations ?? ""}
              onChange={(e) => set("roommateExpectations", e.target.value)}
            />
          </label>
        )}
        <div className="form-grid">
          {field("nickname", "怎么称呼你", 30)}
          {field("occupation", "职业", 40, kind === "room" && !business)}
          <label>
            你的性别
            <select
              value={form.gender ?? "不透露"}
              onChange={(e) =>
                set("gender", e.target.value as LeadDraft["gender"])
              }
            >
              {["男", "女", "其他", "不透露"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <PhotoPicker
          onBusy={setUploadBusy}
          ids={form.photoIds ?? []}
          onChange={(ids) => set("photoIds", ids)}
          upload={async (file) => {
            if (!profile) {
              onLogin();
              throw new Error("请先登录");
            }
            return upload(file);
          }}
        />
        <fieldset>
          <legend>联系方式（不在公开列表展示）</legend>
          <label>
            类型
            <select
              value={form.contactType ?? "wechat"}
              onChange={(e) =>
                set("contactType", e.target.value as LeadDraft["contactType"])
              }
            >
              <option value="wechat">微信</option>
              <option value="phone">手机</option>
            </select>
          </label>
          <label>
            联系方式
            <input
              required
              maxLength={40}
              value={form.contact ?? ""}
              onChange={(e) => set("contact", e.target.value)}
            />
          </label>
          <label>
            谁可以查看
            <select
              required
              value={form.contactVisibility ?? ""}
              onChange={(e) =>
                set(
                  "contactVisibility",
                  e.target.value as LeadDraft["contactVisibility"],
                )
              }
            >
              <option value="">请单独选择</option>
              <option value="operator">仅运营可见</option>
              <option value="members">登录用户可查看</option>
            </select>
          </label>
        </fieldset>
        {[
          ["adult", "我已年满18岁"],
          ["consent", "同意按上述范围使用联系方式"],
          [
            "publicConsent",
            "同意公开展示帖子、照片、昵称和个人介绍；内容真实且不含具体门牌或证件信息",
          ],
        ].map(([name, label]) => (
          <label className="check" key={name}>
            <input
              type="checkbox"
              required
              checked={
                form[name as "adult" | "consent" | "publicConsent"] === true
              }
              onChange={(e) =>
                set(
                  name as "adult" | "consent" | "publicConsent",
                  e.target.checked,
                )
              }
            />
            {label}
          </label>
        ))}
        <div className="actions">
          <button disabled={busy || uploadBusy}>
            {busy
              ? "正在提交…"
              : editing
                ? "保存修改"
                : profile
                  ? "发布帖子"
                  : "登录后发布"}
          </button>
          {!editing && (
            <button
              className="text-button"
              type="button"
              onClick={() => {
                clearDraft(key);
                requestId.current = crypto.randomUUID();
                touched.current.clear();
                setForm({ kind, city, photoIds: [] });
                setMessage("已清除草稿");
              }}
            >
              清除草稿
            </button>
          )}
        </div>
        <p role="status">{message}</p>
      </form>
    </section>
  );
}
