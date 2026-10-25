import { useState, useRef } from "react";
import type { Profile } from "../../shared/business-contracts";
import { api, type Api } from "../client";
import { session } from "../session";
export function AuthForm({
  onDone,
  call = api,
}: {
  onDone: (p: Profile) => void;
  call?: Api;
}) {
  const [mode, setMode] = useState<"login" | "register">("login"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    locked = useRef(false);
  return (
    <section className="panel stack">
      <h1>{mode === "login" ? "登录一起租" : "注册一起租"}</h1>
      <p className="muted">国内试用版使用独立账号，不与原站互通。</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (locked.current) return;
          const f = new FormData(e.currentTarget);
          locked.current = true;
          setBusy(true);
          setError("");
          try {
            const r = await call<{ token: string; profile: Profile }>(
              `auth.${mode}`,
              { email: f.get("email"), password: f.get("password") },
            );
            if (!/^[a-f0-9]{64}$/.test(r.token))
              throw new Error("登录服务返回异常，请重试");
            session.set(r.token);
            onDone(r.profile);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            locked.current = false;
            setBusy(false);
          }
        }}
      >
        <label>
          邮箱
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>
        <label>
          密码
          <input
            name="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={8}
            maxLength={128}
            required
          />
        </label>
        <p className="note">
          密码需8–128位，包含字母和数字。账号未经过邮箱或身份核验，暂不提供邮件找回。
        </p>
        {mode === "register" && (
          <label className="check">
            <input type="checkbox" required />
            我已年满18岁，已阅读使用与隐私说明。
          </label>
        )}
        <button disabled={busy}>
          {busy ? "处理中…" : mode === "login" ? "登录" : "注册"}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
      <button
        className="text-button"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError("");
        }}
      >
        {mode === "login" ? "没有账号？注册" : "已有账号？登录"}
      </button>
    </section>
  );
}
