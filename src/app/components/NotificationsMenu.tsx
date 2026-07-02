import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { api } from "../lib/api";
import { fmtDate } from "../lib/date";
import { EASE, DUR } from "../lib/motion";
import { Markdown } from "../lib/markdown";
import type { Notification } from "../../shared/types";

gsap.registerPlugin(useGSAP);

type NotificationResponse = { items: Notification[]; unreadCount: number };

// nav 上的通知入口：點開先看最近幾則，要翻舊帳再進完整頁面。
// 公告類通知不導頁（歷史資料的 linkUrl 指向 /app），內容就地展開
function externalLink(item: Notification): string | null {
  return item.type === "announcement" ? null : item.linkUrl;
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  function load() {
    api
      .get<NotificationResponse>("/api/my/notifications?limit=6")
      .then((data) => {
        setItems(data.items);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => undefined);
  }

  useEffect(load, []);

  // 換頁時收合
  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    load();
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useGSAP(
    () => {
      if (!open || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.from("[data-menu]", {
        opacity: 0,
        y: -6,
        duration: DUR.quick,
        ease: EASE,
        clearProps: "opacity,transform",
      });
    },
    { scope: rootRef, dependencies: [open] },
  );

  function markRead(item: Notification) {
    if (item.isRead) return;
    void api.post(`/api/my/notifications/${item.id}/read`).then(load).catch(() => undefined);
  }

  function readAll() {
    void api.post("/api/my/notifications/read-all").then(load).catch(() => undefined);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors ${
          open ? "bg-accent/12 text-accent font-medium" : "text-muted hover:text-text hover:bg-surface/60"
        }`}
      >
        通知
        {unreadCount > 0 && (
          <span className="min-w-5 rounded-full bg-accent/15 px-1.5 text-center font-mono text-[11px] leading-5 text-accent">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          data-menu
          className="elev absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border/60 bg-panel/95 backdrop-blur-md"
        >
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">目前沒有通知</p>
          ) : (
            <ul className="max-h-80 divide-y divide-border/40 overflow-y-auto py-1">
              {items.map((item) => {
                const link = externalLink(item);
                const expanded = expandedId === item.id;
                const row = (
                  <span className="flex items-start gap-2">
                    {!item.isRead && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="未讀" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm text-text ${expanded ? "" : "truncate"}`}>{item.title}</span>
                      <span className="mt-0.5 block font-mono text-xs text-muted">{fmtDate(item.createdAt)}</span>
                    </span>
                  </span>
                );
                return (
                  <li key={item.id}>
                    {link ? (
                      <a
                        href={link}
                        onClick={() => markRead(item)}
                        className="block px-4 py-2.5 transition-colors hover:bg-surface/60"
                      >
                        {row}
                      </a>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => {
                            setExpandedId(expanded ? null : item.id);
                            markRead(item);
                          }}
                          className="block w-full px-4 py-2.5 text-left transition-colors hover:bg-surface/60"
                        >
                          {row}
                        </button>
                        {expanded && item.body && (
                          <Markdown text={item.body} className="px-4 pb-2.5 pl-8 text-xs leading-relaxed text-muted" />
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-border/40 px-4 py-2.5 text-xs">
            <Link to="/app/notifications" className="text-muted transition-colors hover:text-text">
              查看全部通知 →
            </Link>
            {unreadCount > 0 && (
              <button type="button" onClick={readAll} className="text-accent">
                全部已讀
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
