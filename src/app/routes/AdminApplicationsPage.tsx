import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Panel, Button, Badge, Loading } from "../components/ui";
import { useReveal } from "../lib/motion";
import type { AccessApplicationWithUser } from "../../shared/types";

export function AdminApplicationsPage() {
  const [apps, setApps] = useState<AccessApplicationWithUser[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    api.get<AccessApplicationWithUser[]>("/api/admin/applications").then(setApps).catch(() => setApps([]));
  }
  useEffect(load, []);

  async function review(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      await api.post(`/api/admin/applications/${id}/${action}`);
      setApps((prev) => prev?.filter((a) => a.id !== id) ?? prev);
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
    </div>
  );
}
