import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Panel, Button, Badge, Loading, Textarea } from "../components/ui";
import { useReveal } from "../lib/motion";
import type { AccessApplicationReviewRecord, AccessApplicationWithUser } from "../../shared/types";

export function AdminApplicationsPage() {
  const [apps, setApps] = useState<AccessApplicationWithUser[] | null>(null);
  const [reviewed, setReviewed] = useState<AccessApplicationReviewRecord[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>({});

  function load() {
    api.get<AccessApplicationWithUser[]>("/api/admin/applications").then(setApps).catch(() => setApps([]));
    api.get<AccessApplicationReviewRecord[]>("/api/admin/applications/reviewed").then(setReviewed).catch(() => setReviewed([]));
  }
  useEffect(load, []);

  async function review(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      const reviewReason = reviewReasons[id]?.trim() || null;
      await api.post(`/api/admin/applications/${id}/${action}`, { reviewReason });
      setApps((prev) => prev?.filter((a) => a.id !== id) ?? prev);
      setReviewed(null);
      api.get<AccessApplicationReviewRecord[]>("/api/admin/applications/reviewed").then(setReviewed).catch(() => setReviewed([]));
      setReviewReasons((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } finally {
      setBusyId(null);
    }
  }

  const scope = useReveal<HTMLDivElement>([apps === null, apps?.length]);

  if (apps === null) return <Loading />;

  return (
    <div ref={scope} className="space-y-6">
      <header data-reveal>
        <p className="section-label">待審核訊號 · {apps.length}</p>
        <h1 className="mt-1 text-2xl font-semibold text-text">申請審核</h1>
      </header>

      {apps.length === 0 ? (
        <p data-reveal className="text-muted">目前沒有待審核的申請</p>
      ) : (
        <ul className="space-y-3">
          {apps.map((app) => (
            <Panel key={app.id} data-reveal className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-text">{app.user.discordGlobalName ?? app.user.discordUsername}</div>
                  <div className="font-mono text-xs text-muted">
                    @{app.user.discordUsername} · {app.user.discordId}
                  </div>
                </div>
                <Badge tone="signal">{new Date(app.createdAt).toLocaleDateString()}</Badge>
              </div>

              {app.message && (
                <p className="border-l-2 border-border pl-3 text-sm text-muted">「{app.message}」</p>
              )}

              <Textarea
                value={reviewReasons[app.id] ?? ""}
                onChange={(e) => setReviewReasons((prev) => ({ ...prev, [app.id]: e.target.value }))}
                placeholder="給申請者的審核補充（選填）"
                maxLength={1000}
              />

              <div className="flex gap-2">
                <Button onClick={() => review(app.id, "approve")} disabled={busyId === app.id}>
                  通過
                </Button>
                <Button variant="danger" onClick={() => review(app.id, "reject")} disabled={busyId === app.id}>
                  拒絕
                </Button>
              </div>
            </Panel>
          ))}
        </ul>
      )}

      <section data-reveal className="space-y-3">
        <div>
          <p className="section-label">最近審核紀錄</p>
          <h2 className="mt-1 text-lg font-semibold text-text">已處理的加入申請</h2>
        </div>
        {reviewed === null ? <Loading /> : reviewed.length === 0 ? (
          <p className="text-muted">還沒有審核紀錄</p>
        ) : (
          <ul className="divide-y divide-border/40 border-y border-border/40">
            {reviewed.map((item) => (
              <li key={item.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-text">
                      {item.user.discordGlobalName ?? item.user.discordUsername}
                      <span className="ml-2 text-xs text-muted">@{item.user.discordUsername}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {item.reviewedAt ? new Date(item.reviewedAt).toLocaleString() : "沒有時間紀錄"}
                      {" · "}
                      {item.reviewer?.discordGlobalName ?? item.reviewer?.discordUsername ?? item.reviewedByUserId ?? "system"}
                    </p>
                  </div>
                  <Badge tone={item.status === "approved" ? "signal" : "accent"}>
                    {item.status === "approved" ? "已通過" : "已拒絕"}
                  </Badge>
                </div>
                {item.reviewReason && (
                  <p className="mt-2 border-l-2 border-border pl-3 text-muted">審核補充：{item.reviewReason}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
