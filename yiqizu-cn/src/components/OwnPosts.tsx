import { useEffect, useState } from "react";
import type { Page, PublicLead } from "../../shared/business-contracts";
import { api } from "../client";
export function OwnPosts({
  edit,
  open,
}: {
  edit: (id: string) => void;
  open: (id: string) => void;
}) {
  const [page, setPage] = useState<Page<PublicLead>>({
      items: [],
      nextCursor: null,
    }),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setPage(await api("leads.list", { mine: true }));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="panel">
      <h2>我的帖子</h2>
      {page.items.map((p) => (
        <div className="operating-row" key={p.id}>
          <h3>{p.title}</h3>
          <p>
            {p.city} · {p.district} · ¥{p.budget}/月
          </p>
          <div className="actions">
            <button className="secondary" onClick={() => edit(p.id)}>
              修改帖子
            </button>
            <button className="text-button" onClick={() => open(p.id)}>
              查看
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("leads.withdraw", { id: p.id });
                  setMessage("已撤回，不再公开展示。撤回不返还今日次数。");
                  await load();
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              撤回
            </button>
          </div>
        </div>
      ))}
      {!page.items.length && <p className="muted">你还没有发布帖子。</p>}
      {page.nextCursor && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api<Page<PublicLead>>("leads.list", {
                mine: true,
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
          加载更多
        </button>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
