import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AnnouncementLevel, SiteAnnouncement } from "../../shared/types";

const levelText: Record<AnnouncementLevel, string> = {
  info: "公告",
  warning: "注意",
  critical: "重要",
};

const levelClass: Record<AnnouncementLevel, string> = {
  info: "border-signal/40 text-signal",
  warning: "border-amber-300/50 text-amber-200",
  critical: "border-accent/60 text-accent",
};

export function AnnouncementStrip({ limit = 3 }: { limit?: number }) {
  const [items, setItems] = useState<SiteAnnouncement[]>([]);

  useEffect(() => {
    api.get<SiteAnnouncement[]>("/api/announcements/active").then(setItems).catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="divide-y divide-border/40 border-y border-border/50">
      {items.slice(0, limit).map((item) => (
        <div key={item.id} className="flex flex-wrap items-start gap-3 py-2.5 text-sm">
          <span className={`rounded-full border px-2 py-0.5 font-mono text-xs ${levelClass[item.level]}`}>
            {levelText[item.level]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-text">{item.title}</p>
            <p className="mt-0.5 text-muted">{item.content}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
