import { useState, useEffect } from "react";
import type {
  PublicLead,
  Page,
  ListingQuery,
} from "../../shared/business-contracts";
import { CITY_CONFIG } from "../../shared/cities";
import { api, type Api } from "../client";
import { Photo } from "./Photo";
export function PostCard({
  post: p,
  open,
}: {
  post: PublicLead;
  open: () => void;
}) {
  return (
    <article className="post-card" onClick={open}>
      <button className="card-open" type="button" aria-label={`查看${p.title}`}>
        <div className="card-image">
          <Photo id={p.photoIds?.[0]} alt={p.title} />
          <span className="badge">
            {p.kind === "room" ? "有房 · 招室友" : "无房 · 找住处"}
          </span>
        </div>
        <div className="card-body">
          <h3>{p.title}</h3>
          <p className="card-location">
            {p.city} · {p.district}
          </p>
          <p className="price">
            ¥{p.budget.toLocaleString()}
            <small>/月{p.kind === "seeker" ? " · 个人预算" : ""}</small>
          </p>
          <div className="card-tags">
            {(p.housing?.amenities ?? []).slice(0, 4).map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
          <div className="card-publisher">{p.publisher.nickname}</div>
          <div className="card-meta">
            <span>{p.moveIn}</span>
            <span>
              {p.kind === "seeker"
                ? `预计租${p.minLeaseMonths}个月`
                : `${p.minLeaseMonths}个月起`}
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}
export function Catalog({
  city,
  open,
  mine = false,
  call = api,
}: {
  city: string;
  open: (id: string) => void;
  mine?: boolean;
  call?: Api;
}) {
  const [query, setQuery] = useState<ListingQuery>({}),
    [district, setDistrict] = useState(""),
    [min, setMin] = useState(""),
    [max, setMax] = useState(""),
    [bedrooms, setBedrooms] = useState(""),
    [tags, setTags] = useState("");
  const [page, setPage] = useState<Page<PublicLead>>({
      items: [],
      nextCursor: null,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    void call<Page<PublicLead>>("leads.list", {
      ...query,
      ...(!mine ? { city } : {}),
      mine,
    })
      .then((r) => {
        if (active) setPage(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [city, mine, query, call, retry]);
  async function more() {
    if (busy || !page.nextCursor) return;
    setBusy(true);
    try {
      const r = await call<Page<PublicLead>>("leads.list", {
        ...query,
        ...(!mine ? { city } : {}),
        mine,
        cursor: page.nextCursor,
      });
      setPage((p) => ({
        items: [...p.items, ...r.items],
        nextCursor: r.nextCursor,
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="section-title">
        <h2>{mine ? "我的帖子" : "发现合拍的室友"}</h2>
      </div>
      {!mine && (
        <>
          <div className="tabs">
            {[
              ["", "全部推荐"],
              ["room", "有房找室友"],
              ["seeker", "无房找住处"],
            ].map(([kind, label]) => (
              <button
                key={kind}
                className={
                  query.kind === kind || (!kind && !query.kind) ? "active" : ""
                }
                onClick={() =>
                  setQuery((q) => ({
                    ...q,
                    kind: (kind as "room" | "seeker") || undefined,
                  }))
                }
              >
                {label}
              </button>
            ))}
          </div>
          <form
            className="filters"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery((q) => ({
                ...q,
                district: district || undefined,
                minPrice: min ? Number(min) : undefined,
                maxPrice: max ? Number(max) : undefined,
                bedrooms: bedrooms ? (Number(bedrooms) as 2 | 3) : undefined,
                amenities: tags
                  ? tags
                      .split(/[，,]/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : undefined,
              }));
            }}
          >
            <select
              aria-label="片区筛选"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            >
              <option value="">全部片区</option>
              {CITY_CONFIG[city].districts.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <input
              aria-label="最低月租"
              type="number"
              placeholder="最低月租"
              value={min}
              onChange={(e) => setMin(e.target.value)}
            />
            <input
              aria-label="最高月租"
              type="number"
              placeholder="最高月租"
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
            <select
              aria-label="户型筛选"
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
            >
              <option value="">全部户型</option>
              <option value="2">两室</option>
              <option value="3">三室</option>
            </select>
            <input
              aria-label="设施筛选"
              placeholder="设施标签，逗号分隔"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <button>筛选</button>
          </form>
        </>
      )}
      {error ? (
        <div role="alert">
          {error}
          <button onClick={() => setRetry((r) => r + 1)}>重试</button>
        </div>
      ) : null}
      <div className="card-grid">
        {page.items.map((p) => (
          <PostCard key={p.id} post={p} open={() => open(p.id)} />
        ))}
      </div>
      {busy && <p role="status">正在加载…</p>}
      {!busy && !error && !page.items.length && (
        <div className="empty-state">
          {mine
            ? "你还没有发布帖子。"
            : "这里还没有合适的帖子，登记你的需求，让合拍的人找到你。"}
        </div>
      )}
      {page.nextCursor && (
        <button disabled={busy} onClick={() => void more()}>
          加载更多
        </button>
      )}
    </section>
  );
}
