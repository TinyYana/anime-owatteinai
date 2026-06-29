import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { fmtDate } from "../lib/date";
import { Button, Loading } from "../components/ui";
import { useReveal } from "../lib/motion";
import type { Notification } from "../../shared/types";

type NotificationResponse = { items: Notification[]; unreadCount: number };

export function NotificationsPage() {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const scope = useReveal<HTMLDivElement>([items === null]);

  function load() {
    api.get<NotificationResponse>("/api/my/notifications").then((data) => {
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    }).catch(() => {
      setItems([]);
      setUnreadCount(0);
    });
  }

  useEffect(load, []);

  async function read(id: string) {
    await api.post(`/api/my/notifications/${id}/read`);
    load();
  }

  async function readAll() {
    await api.post("/api/my/notifications/read-all");
    load();
  }

  if (items === null) return <Loading />;

  return (
    <div ref={scope} className="space-y-6">
      <header data-reveal className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-label">站內通知 · {unreadCount} 未讀</p>
          <h1 className="mt-1 text-2xl font-semibold text-text">通知</h1>
        </div>
        <Button variant="ghost" disabled={unreadCount === 0} onClick={readAll}>全部已讀</Button>
      </header>

      {items.length === 0 ? (
        <p data-reveal className="text-muted">目前沒有通知</p>
      ) : (
        <ul data-reveal className="divide-y divide-border/40 border-y border-border/50">
          {items.map((item) => (
            <li key={item.id} className="grid gap-2 py-3 text-sm md:grid-cols-[minmax(0,1fr)_8rem_5rem] md:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {!item.isRead && <span className="h-2 w-2 rounded-full bg-accent" aria-label="未讀" />}
                  {item.linkUrl ? (
                    <a
                      href={item.linkUrl}
                      onClick={() => void read(item.id)}
                      className="font-medium text-text transition-colors hover:text-accent"
                    >
                      {item.title}
                    </a>
                  ) : (
                    <span className="font-medium text-text">{item.title}</span>
                  )}
                </div>
                {item.body && <p className="mt-1 truncate text-muted">{item.body}</p>}
              </div>
              <time className="font-mono text-xs text-muted md:text-right">
                {fmtDate(item.createdAt)}
              </time>
              {item.isRead ? (
                <span className="text-xs text-muted md:text-right">已讀</span>
              ) : (
                <button onClick={() => read(item.id)} className="text-xs text-accent md:text-right">
                  標為已讀
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Link to="/app" className="section-label inline-block transition-colors hover:text-text">← 回接著看</Link>
    </div>
  );
}
