import { useEffect, useState } from "react";
import type { Page, PrivateLead } from "../../shared/business-contracts";
import type { FeedbackRecord } from "../../server/operations";
import { api } from "../client";
export function Operations() {
  const [page, setPage] = useState<Page<PrivateLead>>({
      items: [],
      nextCursor: null,
    }),
    [feedback, setFeedback] = useState<Page<FeedbackRecord>>({
      items: [],
      nextCursor: null,
    }),
    [metrics, setMetrics] = useState<{
      events: { event: string; sessions: number }[];
      registrations: { source: string; status: string; count: number }[];
    } | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const [p, f, m] = await Promise.all([
        api<Page<PrivateLead>>("operations.list", {}),
        api<Page<FeedbackRecord>>("operations.feedback", {}),
        api<typeof metrics>("operations.metrics", {}),
      ]);
      setPage(p);
      setFeedback(f);
      setMetrics(m);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function update(action: string, payload: unknown) {
    setBusy(true);
    try {
      await api(action, payload);
      setMessage("已更新");
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h1>运营工作台</h1>
      <p className="muted">近半年登记与跟进；公开状态和跟进状态分别管理。</p>
      <div className="actions">
        <button disabled={busy} onClick={() => void load()}>
          刷新
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api<{
                hidden: number;
                deleted: number;
                retry: number;
              }>("operations.cleanup", {});
              setMessage(
                `清理过期帖子${r.hidden}条、图片${r.deleted}个，待重试${r.retry}个。可继续点击处理下一批。`,
              );
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          清理过期内容
        </button>
      </div>
      <p role="status">{message}</p>
      {metrics && (
        <section className="panel">
          <h2>近7天数据</h2>
          {metrics.events.map((x) => (
            <p key={x.event}>
              {x.event}：{x.sessions}个访问会话
            </p>
          ))}
          {metrics.registrations.map((x) => (
            <p key={x.source + x.status}>
              {x.source} · {x.status}：{x.count}条登记
            </p>
          ))}
          <p className="note">
            点击不等于有效需求、成功联系或匹配。测试来源不计入统计。
          </p>
        </section>
      )}
      <section className="panel">
        <h2>登记列表</h2>
        {page.items.map((p) => (
          <article key={p.id} className="operating-row">
            <h3>{p.title}</h3>
            <p>
              {p.city} · {p.district} · {p.nickname} ·{" "}
              {p.contactType === "phone" ? "手机" : "微信"}：{p.contact}
            </p>
            <p>{p.note}</p>
            <div className="actions">
              <label>
                跟进状态
                <select
                  value={p.followupStatus}
                  disabled={busy}
                  onChange={(e) =>
                    void update("operations.followup", {
                      id: p.id,
                      status: e.target.value,
                    })
                  }
                >
                  {[
                    ["new", "新登记"],
                    ["qualified", "有效需求"],
                    ["contacted", "已联系"],
                    ["viewing", "已约看"],
                    ["matched", "已匹配"],
                    ["invalid", "无效"],
                  ].map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="secondary"
                disabled={busy || p.visibility === "withdrawn"}
                onClick={() =>
                  void update("operations.moderate", {
                    id: p.id,
                    visibility: p.visibility === "hidden" ? "active" : "hidden",
                  })
                }
              >
                {p.visibility === "hidden"
                  ? "恢复展示"
                  : p.visibility === "withdrawn"
                    ? "已撤回"
                    : "下架"}
              </button>
            </div>
          </article>
        ))}
        {page.nextCursor && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api<Page<PrivateLead>>("operations.list", {
                  cursor: page.nextCursor,
                });
                setPage((p) => ({
                  items: [...p.items, ...r.items],
                  nextCursor: r.nextCursor,
                }));
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            加载更多登记
          </button>
        )}
      </section>
      <section className="panel">
        <h2>反馈与举报</h2>
        {feedback.items.map((f) => (
          <article key={f.id} className="operating-row">
            <strong>
              {f.category} · {f.status === "resolved" ? "已处理" : "待处理"}
            </strong>
            <p>{f.content}</p>
            <p>回复方式：{f.contact || "未填写"}</p>
            {f.status === "new" && (
              <button
                disabled={busy}
                onClick={() =>
                  void update("operations.resolveFeedback", { id: f.id })
                }
              >
                标记已处理
              </button>
            )}
          </article>
        ))}
        {feedback.nextCursor && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api<Page<FeedbackRecord>>(
                  "operations.feedback",
                  { cursor: feedback.nextCursor },
                );
                setFeedback((p) => ({
                  items: [...p.items, ...r.items],
                  nextCursor: r.nextCursor,
                }));
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            加载更多反馈
          </button>
        )}
      </section>
    </section>
  );
}
