import { useEffect, useState } from "react";
import type { PublicLead } from "../../shared/business-contracts";
import { api } from "../client";
import { Photo } from "./Photo";
export function Details({
  id,
  back,
  login,
}: {
  id: string;
  back: () => void;
  login: () => void;
}) {
  const [post, setPost] = useState<PublicLead | null>(null),
    [error, setError] = useState(""),
    [contact, setContact] = useState<{
      type: string;
      value: string;
      remaining: number;
    } | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setPost(null);
    void api<PublicLead>("leads.get", { id })
      .then((p) => {
        if (active) setPost(p);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function reveal() {
    setBusy(true);
    try {
      setContact(await api("leads.contact", { id }));
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 401) login();
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  if (!post)
    return (
      <section className="panel">
        <button onClick={back}>← 返回发现</button>
        <p role="status">{error || "正在加载…"}</p>
      </section>
    );
  const p = post,
    business =
      p.housing?.housingState === "landlord" ||
      p.housing?.housingState === "agent";
  return (
    <div className="details">
      <button className="back" onClick={back}>
        ← 返回发现
      </button>
      <div className="detail-gallery">
        {p.photoIds.length ? (
          p.photoIds.map((photo) => (
            <Photo key={photo} id={photo} alt={p.title} />
          ))
        ) : (
          <Photo alt="暂无照片" />
        )}
      </div>
      <section className="panel">
        <span className="pill">
          {p.kind === "room" ? "有房找室友" : "无房找住处"}
          {business
            ? ` · ${p.housing?.housingState === "agent" ? "中介自述" : "房东自述"}`
            : ""}
        </span>
        <h1>{p.title}</h1>
        <p className="price">
          ¥{p.budget.toLocaleString()}
          <small>
            /月{p.kind === "seeker" ? " · 个人预算" : " · 每人月租"}
          </small>
        </p>
        <div className="specs">
          {p.housing && (
            <>
              <div>
                <strong>
                  {p.housing.bedrooms}室{p.housing.bathrooms}卫
                </strong>
                <span>原始户型</span>
              </div>
              <div>
                <strong>{p.housing.area}㎡</strong>
                <span>整套面积</span>
              </div>
            </>
          )}
          <div>
            <strong>{p.moveIn}</strong>
            <span>起租时间</span>
          </div>
          <div>
            <strong>
              {p.kind === "seeker"
                ? `预计租${p.minLeaseMonths}个月`
                : `${p.minLeaseMonths}个月起`}
            </strong>
            <span>租期</span>
          </div>
          <div>
            <strong>
              {p.preferredGender === "不限" ? "不限" : p.preferredGender + "生"}
            </strong>
            <span>性别要求</span>
          </div>
        </div>
      </section>
      <section className="panel">
        <p className="muted">位置信息</p>
        <h2>
          {p.city} · {p.district}
          {p.housing ? " · " + p.housing.community : ""}
        </h2>
        <a
          href={`https://uri.amap.com/search?keyword=${encodeURIComponent(p.city + p.district + (p.housing?.community ?? ""))}`}
          target="_blank"
          rel="noreferrer"
        >
          高德地图查看 ↗
        </a>
        <p className="muted">
          只展示小区或大致位置，不公开门牌号，请在看房前核实。
        </p>
      </section>
      <section className="panel">
        <h2>关于{p.kind === "room" ? "房主" : "发布者"}</h2>
        <strong>{p.publisher.nickname}</strong>
        <p className="muted">{p.publisher.occupation}</p>
        <p>{p.publisher.bio || "发布者暂未补充个人介绍。"}</p>
      </section>
      <section className="panel">
        <h2>{p.kind === "room" ? "关于房子" : "我的求租需求"}</h2>
        <p>{p.note}</p>
      </section>
      {p.housing && (
        <>
          <section className="panel">
            <h2>房屋设施</h2>
            <div className="chips">
              {p.housing.amenities.map((a) => (
                <span key={a}>{a}</span>
              ))}
            </div>
          </section>
          <section className="panel">
            <h2>合租要求</h2>
            <p>{p.coRentalRules || "发布者暂未补充。"}</p>
          </section>
        </>
      )}
      {!business && (
        <section className="panel">
          <h2>室友期待</h2>
          <p>{p.roommateExpectations}</p>
        </section>
      )}
      <section className="panel contact-panel">
        <h2>联系发布者</h2>
        <p className="muted">请自行核实房源和身份，看房前不要转账。</p>
        {contact ? (
          <>
            <p>
              {contact.type === "phone" ? "手机" : "微信"}：
              <strong>{contact.value}</strong>
            </p>
            <p>今日还可查看{contact.remaining}个不同联系对象</p>
          </>
        ) : p.contactAvailable ? (
          <button disabled={busy} onClick={() => void reveal()}>
            查看联系方式
          </button>
        ) : (
          <p>发布者仅授权运营查看联系方式。</p>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
    </div>
  );
}
