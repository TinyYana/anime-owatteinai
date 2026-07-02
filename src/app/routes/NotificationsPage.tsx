import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { api } from "../lib/api";
import { fmtDate } from "../lib/date";
import { Button, Loading } from "../components/ui";
import { useReveal, EASE, DUR } from "../lib/motion";
import { Markdown } from "../lib/markdown";
import type { Notification } from "../../shared/types";

gsap.registerPlugin(useGSAP);

type NotificationResponse = { items: Notification[]; unreadCount: number };

// 公告類通知的 linkUrl 歷史上指向 /app，點了只會回 dashboard——一律忽略，
// 內容直接在列表裡展開閱讀。
function externalLink(item: Notification): string | null {
  return item.type === "announcement" ? null : item.linkUrl;
}

export function NotificationsPage() {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
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

  useGSAP(
    () => {
      if (!expandedId || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from("[data-expand]", {
        opacity: 0,
        y: -4,
        duration: DUR.quick,
        ease: EASE,
        clearProps: "opacity,transform",
      });
    },
    { scope, dependencies: [expandedId] },
  );

  async function read(id: string) {
    await api.post(`/api/my/notifications/${id}/read`);
    load();
  }

  async function readAll() {
    await api.post("/api/my/notifications/read-all");
    load();
  }

  function toggle(item: Notification) {
    const next = expandedId === item.id ? null : item.id;
    setExpandedId(next);
    if (next && !item.isRead) void read(item.id);
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
          {items.map((item) => {
            const expanded = expandedId === item.id;
            const link = externalLink(item);
            return (
              <li key={item.id} className="py-3 text-sm">
                <button
                  type="button"
                  onClick={() => toggle(item)}
                  aria-expanded={expanded}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {!item.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="未讀" />}
                    <span className={`font-medium text-text ${expanded ? "" : "truncate"}`}>{item.title}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <time className="font-mono text-xs text-muted">{fmtDate(item.createdAt)}</time>
                    <span
                      className={`text-muted transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  </span>
                </button>

                {!expanded && item.body && (
                  <p className="mt-1 truncate text-muted">{item.body}</p>
                )}

                {expanded && (
                  <div data-expand className="mt-2 space-y-2">
                    {item.body ? (
                      <Markdown text={item.body} className="leading-relaxed text-muted" />
                    ) : (
                      <p className="text-muted/70">這則通知沒有內文</p>
                    )}
                    {link && (
                      <a href={link} className="inline-block text-accent transition-colors hover:text-text">
                        前往相關頁面 →
                      </a>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Link to="/app" className="section-label inline-block transition-colors hover:text-text">← 回接著看</Link>
    </div>
  );
}
