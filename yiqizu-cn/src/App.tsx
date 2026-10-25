import { useState, useEffect } from "react";
import { CITIES } from "../shared/cities";
import type { Profile, PrivateLead } from "../shared/business-contracts";
import { Catalog } from "./components/Catalog";
import { Details } from "./components/Details";
import { HelpCenter } from "./components/HelpCenter";
import { AuthForm } from "./components/AuthForm";
import { ProfileForm } from "./components/ProfileForm";
import { IntakeForm } from "./components/IntakeForm";
import { OwnPosts } from "./components/OwnPosts";
import { Operations } from "./components/Operations";
import { api } from "./client";
import { session } from "./session";
function current() {
  const q = new URLSearchParams(location.search);
  return { view: q.get("view") ?? "explore", post: q.get("post") ?? "" };
}
export function App() {
  const [route, setRoute] = useState(current),
    [city, setCity] = useState("贵阳"),
    [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(Boolean(session.get())),
    [authOpen, setAuthOpen] = useState(false),
    [message, setMessage] = useState(""),
    [editing, setEditing] = useState<PrivateLead | null>(null);
  useEffect(() => {
    const pop = () => setRoute(current()),
      clear = () => {
        setProfile(null);
        setEditing(null);
      };
    window.addEventListener("popstate", pop);
    window.addEventListener("yiqizu-session-cleared", clear);
    if (session.get())
      void api<Profile>("auth.session", {})
        .then(setProfile)
        .catch((e) => setMessage(e.message))
        .finally(() => setLoading(false));
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("yiqizu-session-cleared", clear);
    };
  }, []);
  useEffect(() => {
    let active = true;
    setEditing(null);
    if (route.view === "edit" && profile)
      void api<PrivateLead>("leads.owned", { id: route.post })
        .then((p) => {
          if (active) setEditing(p);
        })
        .catch((e) => {
          if (active) setMessage(e.message);
        });
    return () => {
      active = false;
    };
  }, [route.view, route.post, profile?.id]);
  useEffect(() => {
    let sessionId: string;
    try {
      sessionId =
        sessionStorage.getItem("yiqizu-cn:visit") ?? crypto.randomUUID();
      sessionStorage.setItem("yiqizu-cn:visit", sessionId);
    } catch {
      sessionId = crypto.randomUUID();
    }
    const source =
      new URLSearchParams(location.search).get("source") ?? "direct";
    void api("events.record", {
      event:
        route.view === "detail"
          ? "detail_open"
          : route.view.startsWith("publish-")
            ? "quick_open"
            : "visit",
      eventId: crypto.randomUUID(),
      sessionId,
      city,
      source,
    }).catch(() => {});
  }, [route.view, route.post, city]);
  function navigate(view: string, post?: string) {
    const url = new URL(location.href);
    url.searchParams.set("view", view);
    if (post) url.searchParams.set("post", post);
    else url.searchParams.delete("post");
    history.pushState({}, "", url);
    setRoute(current());
    setMessage("");
    window.scrollTo?.(0, 0);
  }
  const done = (p: Profile) => {
    setProfile(p);
    setAuthOpen(false);
    setLoading(false);
    setMessage("");
  };
  let content;
  if (route.view === "detail")
    content = (
      <Details
        key={route.post + ":" + (profile?.id ?? "guest")}
        id={route.post}
        back={() => navigate("explore")}
        login={() => setAuthOpen(true)}
      />
    );
  else if (route.view === "help") content = <HelpCenter />;
  else if (route.view === "profile")
    content = loading ? (
      <p>正在恢复登录…</p>
    ) : !profile ? (
      <AuthForm onDone={done} />
    ) : (
      <>
        <section className="panel account-banner">
          <div>
            <h1>{profile.nickname || "我的"}</h1>
            <p className="muted">{profile.email}</p>
            <span className="pill">身份未经核验</span>
          </div>
          <button
            className="secondary"
            onClick={async () => {
              try {
                await api("auth.logout", {});
                session.clear();
                setProfile(null);
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            退出登录
          </button>
        </section>
        {profile.isAdmin && (
          <button onClick={() => navigate("operations")}>运营工作台</button>
        )}
        <OwnPosts
          key={profile.id}
          edit={(id) => navigate("edit", id)}
          open={(id) => navigate("detail", id)}
        />
        <ProfileForm key={profile.id} profile={profile} onSave={setProfile} />
        <section className="panel stack">
          <h2>修改密码</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await api("auth.changePassword", {
                  oldPassword: f.get("oldPassword"),
                  password: f.get("password"),
                });
                session.clear();
                setProfile(null);
                setMessage("密码已修改，请重新登录。");
              } catch (err) {
                setMessage((err as Error).message);
              }
            }}
          >
            <label>
              原密码
              <input
                name="oldPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              新密码
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </label>
            <button>修改密码并退出全部登录</button>
          </form>
        </section>
      </>
    );
  else if (route.view === "operations")
    content = profile?.isAdmin ? (
      <Operations />
    ) : (
      <section className="panel">
        <p>请使用运营账号登录。</p>
        <button onClick={() => navigate("profile")}>前往登录</button>
      </section>
    );
  else if (route.view === "edit")
    content = loading ? (
      <p>正在恢复登录…</p>
    ) : !profile ? (
      <AuthForm onDone={done} />
    ) : editing ? (
      <IntakeForm
        key={editing.id + editing.version}
        kind={editing.kind}
        city={editing.city}
        profile={profile}
        editing={editing}
        onLogin={() => setAuthOpen(true)}
        onDone={(id) => navigate("detail", id)}
      />
    ) : (
      <p>{message || "正在读取帖子…"}</p>
    );
  else if (route.view === "publish-room" || route.view === "publish-seeker")
    content = loading ? <p>正在恢复登录与草稿…</p> : (
      <IntakeForm
        key={route.view}
        kind={route.view === "publish-room" ? "room" : "seeker"}
        city={city}
        profile={profile}
        onLogin={() => setAuthOpen(true)}
        onDone={(id) => navigate("detail", id)}
      />
    );
  else
    content = (
      <>
        <section className="hero">
          <span className="eyebrow">找到住处，也找到合拍的人</span>
          <h1>一起住，让生活多一点可能。</h1>
          <p>真实登记，认真沟通。在这里寻找合适的室友与住处。</p>
          <div className="entry-grid">
            <button onClick={() => navigate("publish-room")}>
              <strong>有房找室友</strong>
              <span>发布房屋和合租信息 ↗</span>
            </button>
            <button onClick={() => navigate("publish-seeker")}>
              <strong>无房找住处</strong>
              <span>登记你的求租需求 ↗</span>
            </button>
          </div>
        </section>
        <Catalog city={city} open={(id) => navigate("detail", id)} />
      </>
    );
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <select
            aria-label="当前城市"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          >
            {CITIES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <button className="brand" onClick={() => navigate("explore")}>
            一起租
          </button>
          <button className="text-button" onClick={() => navigate("help")}>
            使用说明
          </button>
        </div>
      </header>
      <main className="container">
        {message && route.view !== "edit" && <p role="status">{message}</p>}
        {content}
      </main>
      <nav className="bottom-nav" aria-label="主导航">
        <button
          className={route.view === "explore" ? "active" : ""}
          onClick={() => navigate("explore")}
        >
          ⌂<span>首页</span>
        </button>
        <button onClick={() => navigate("publish-seeker")}>
          <b>＋</b>
          <span>登记需求</span>
        </button>
        <button
          className={route.view === "profile" ? "active" : ""}
          onClick={() => navigate("profile")}
        >
          ♙<span>我的</span>
        </button>
      </nav>
      {authOpen && (
        <div className="modal-backdrop">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="登录后继续"
            className="modal"
          >
            <button className="text-button" onClick={() => setAuthOpen(false)}>
              关闭
            </button>
            <AuthForm onDone={done} />
          </div>
        </div>
      )}
    </>
  );
}
