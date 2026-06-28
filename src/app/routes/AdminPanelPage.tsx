import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Panel, Button, Badge, Loading, Input, Select, Textarea } from "../components/ui";
import { useReveal } from "../lib/motion";
import { hasPermission, useAuth } from "../lib/auth";
import { ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_LEVELS, ROLE_PERMISSION_LABELS, ROLE_PERMISSIONS, USER_ROLES } from "../../shared/types";
import type { AnnouncementAudience, AnnouncementLevel, AnimeEditRequest, RolePermission, RolePermissionConfig, SiteAnnouncement, UserRole } from "../../shared/types";

const ROLE_LABEL: Record<UserRole, string> = {
  owner: "擁有者", admin: "管理員", moderator: "板務", member: "成員", pending: "待審核", banned: "封鎖",
};
const ROLE_TONE: Record<UserRole, "muted" | "accent" | "signal"> = {
  owner: "accent", admin: "signal", moderator: "signal", member: "muted", pending: "muted", banned: "accent",
};

type AdminUser = {
  id: string;
  discordId: string;
  discordUsername: string;
  discordGlobalName: string | null;
  role: UserRole;
  lastLoginAt: string | null;
  createdAt: string;
  animeCount: number;
};
type Stats = {
  users: { total: number; members: number; admins: number; moderators: number; pending: number; banned: number };
  animeTotal: number;
  sessionTotal: number;
  pendingApplications: number;
  pendingEditRequests: number;
};
type Activity = {
  id: string;
  animeId: string;
  episodeNumber: number;
  completed: boolean;
  watchedAt: string;
  userName: string | null;
  animeTitle: string | null;
  animeTitleFallback: string;
};
type AuditLog = {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
  actorName: string | null;
};

type TestUser = {
  id: string;
  discordId: string;
  discordUsername: string;
  discordGlobalName: string | null;
  role: UserRole;
  createdAt: string;
};

type DiscordStatus = { botToken: boolean; guildId: boolean; publicKey: boolean; notificationChannelId: boolean };
type Tab = "stats" | "users" | "roles" | "edits" | "activity" | "audit" | "announcements" | "test" | "discord";

const ANNOUNCEMENT_LEVEL_LABEL: Record<AnnouncementLevel, string> = {
  info: "一般",
  warning: "注意",
  critical: "重要",
};
const ANNOUNCEMENT_AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  all: "全部",
  member: "成員",
  admin: "管理員",
};

export function AdminPanelPage() {
  const { me, refetch } = useAuth();
  const [tab, setTab] = useState<Tab>("stats");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [roleConfigs, setRoleConfigs] = useState<RolePermissionConfig[] | null>(null);
  const [editRequests, setEditRequests] = useState<AnimeEditRequest[] | null>(null);
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[] | null>(null);
  const [announcements, setAnnouncements] = useState<SiteAnnouncement[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testUsers, setTestUsers] = useState<TestUser[] | null>(null);
  const [discordStatus, setDiscordStatus] = useState<DiscordStatus | null>(null);
  const [discordRegisterResult, setDiscordRegisterResult] = useState<string | null>(null);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
    level: "info" as AnnouncementLevel,
    audience: "all" as AnnouncementAudience,
    isActive: true,
    startsAt: "",
    endsAt: "",
  });
  const canManageRoles = hasPermission(me, "roles.manage");
  const canManageUsers = hasPermission(me, "users.manage");
  const canManageAnnouncements = me?.role === "owner" || me?.role === "admin";

  const scope = useReveal<HTMLDivElement>([tab]);

  useEffect(() => {
    api.get<Stats>("/api/admin/panel/stats").then(setStats).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (tab === "users" && users === null) {
      api.get<AdminUser[]>("/api/admin/panel/users").then(setUsers).catch(() => setUsers([]));
    }
    if (tab === "roles" && roleConfigs === null) {
      api.get<RolePermissionConfig[]>("/api/admin/panel/roles").then(setRoleConfigs).catch(() => setRoleConfigs([]));
    }
    if (tab === "activity" && activity === null) {
      api.get<Activity[]>("/api/admin/panel/activity").then(setActivity).catch(() => setActivity([]));
    }
    if (tab === "audit" && auditLogs === null) {
      api.get<AuditLog[]>("/api/admin/panel/audit-logs").then(setAuditLogs).catch(() => setAuditLogs([]));
    }
    if (tab === "edits" && editRequests === null) {
      api.get<AnimeEditRequest[]>("/api/admin/panel/edit-requests").then(setEditRequests).catch(() => setEditRequests([]));
    }
    if (tab === "announcements" && announcements === null) {
      api.get<SiteAnnouncement[]>("/api/admin/announcements").then(setAnnouncements).catch(() => setAnnouncements([]));
    }
    if (tab === "test" && testUsers === null) {
      api.get<TestUser[]>("/api/admin/panel/test/users").then(setTestUsers).catch(() => setTestUsers([]));
    }
    if (tab === "discord" && discordStatus === null) {
      api.get<DiscordStatus>("/api/admin/panel/discord/status").then(setDiscordStatus).catch(() => undefined);
    }
  }, [tab, users, roleConfigs, activity, auditLogs, editRequests, announcements, testUsers, discordStatus]);

  async function changeRole(userId: string, role: UserRole) {
    setBusyId(userId);
    try {
      await api.patch(`/api/admin/panel/users/${userId}`, { role });
      setUsers((prev) => prev?.map((u) => (u.id === userId ? { ...u, role } : u)) ?? prev);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleRolePermission(role: UserRole, permission: RolePermission, checked: boolean) {
    const current = roleConfigs?.find((item) => item.role === role);
    if (!current) return;
    const permissions = checked
      ? ROLE_PERMISSIONS.filter((item) => item === permission || current.permissions.includes(item))
      : current.permissions.filter((item) => item !== permission);
    setBusyId(`role:${role}`);
    try {
      const updated = await api.put<RolePermissionConfig>(`/api/admin/panel/roles/${role}/permissions`, { permissions });
      setRoleConfigs((prev) => prev?.map((item) => (item.role === role ? updated : item)) ?? prev);
      if (me?.role === role) await refetch();
    } finally {
      setBusyId(null);
    }
  }

  async function seedTest(flow: "application" | "member") {
    setBusyId(`test:seed:${flow}`);
    try {
      await api.post("/api/admin/panel/test/seed", { flow });
      setTestUsers(null);
    } finally {
      setBusyId(null);
    }
  }

  async function cleanupTest() {
    if (!window.confirm("確認刪除所有測試資料？此操作無法復原。")) return;
    setBusyId("test:cleanup");
    try {
      await api.del("/api/admin/panel/test/cleanup");
      setTestUsers(null);
    } finally {
      setBusyId(null);
    }
  }

  async function reviewEdit(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      await api.post(`/api/admin/panel/edit-requests/${id}/review`, { action });
      setEditRequests((prev) =>
        prev?.map((r) => (r.id === id ? { ...r, status: action === "approve" ? "approved" : "rejected" } : r)) ?? prev,
      );
    } finally {
      setBusyId(null);
    }
  }

  function resetAnnouncementForm() {
    setAnnouncementError(null);
    setEditingAnnouncementId(null);
    setAnnouncementForm({
      title: "",
      content: "",
      level: "info",
      audience: "all",
      isActive: true,
      startsAt: "",
      endsAt: "",
    });
  }

  function editAnnouncement(item: SiteAnnouncement) {
    setEditingAnnouncementId(item.id);
    setAnnouncementForm({
      title: item.title,
      content: item.content,
      level: item.level,
      audience: item.audience,
      isActive: item.isActive,
      startsAt: item.startsAt ? new Date(item.startsAt).toISOString().slice(0, 16) : "",
      endsAt: item.endsAt ? new Date(item.endsAt).toISOString().slice(0, 16) : "",
    });
  }

  async function saveAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...announcementForm,
      startsAt: announcementForm.startsAt ? new Date(announcementForm.startsAt).toISOString() : null,
      endsAt: announcementForm.endsAt ? new Date(announcementForm.endsAt).toISOString() : null,
    };
    setBusyId("announcement:save");
    setAnnouncementError(null);
    try {
      if (editingAnnouncementId) {
        const updated = await api.patch<SiteAnnouncement>(`/api/admin/announcements/${editingAnnouncementId}`, payload);
        setAnnouncements((prev) => prev?.map((item) => item.id === updated.id ? updated : item) ?? prev);
      } else {
        const created = await api.post<SiteAnnouncement>("/api/admin/announcements", payload);
        setAnnouncements((prev) => [created, ...(prev ?? [])]);
      }
      resetAnnouncementForm();
    } catch (err) {
      setAnnouncementError(err instanceof Error ? err.message : "公告儲存失敗，請確認資料庫遷移已執行（pnpm db:migrate）。");
    } finally {
      setBusyId(null);
    }
  }

  async function deactivateAnnouncement(id: string) {
    setBusyId(`announcement:${id}`);
    try {
      await api.del(`/api/admin/announcements/${id}`);
      setAnnouncements((prev) => prev?.map((item) => item.id === id ? { ...item, isActive: false } : item) ?? prev);
    } finally {
      setBusyId(null);
    }
  }

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
        tab === t ? "bg-accent/12 text-accent" : "text-muted hover:text-text hover:bg-surface/60"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div ref={scope} className="space-y-6">
      <header data-reveal className="flex items-baseline justify-between">
        <div>
          <p className="section-label">系統管理</p>
          <h1 className="mt-1 text-2xl font-semibold text-text">Admin Panel</h1>
        </div>
        <Link to="/app/admin/applications">
          <Button variant="ghost">
            審核申請{stats?.pendingApplications ? ` (${stats.pendingApplications})` : ""}
          </Button>
        </Link>
      </header>

      <nav data-reveal className="flex gap-1 border-b border-border/40 pb-0">
        {tabBtn("stats", "總覽")}
        {tabBtn("users", "使用者")}
        {tabBtn("roles", "身份權限")}
        {tabBtn("edits", `動畫編輯${stats?.pendingEditRequests ? ` (${stats.pendingEditRequests})` : ""}`)}
        {tabBtn("activity", "觀看紀錄")}
        {tabBtn("audit", "審計")}
        {tabBtn("announcements", "公告")}
        {tabBtn("test", "測試")}
        {tabBtn("discord", "Discord")}
      </nav>

      {tab === "stats" && (
        <div data-reveal className="space-y-6">
          {stats === null ? <Loading /> : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="總使用者" value={stats.users.total} />
                <StatCard label="正式成員" value={stats.users.total - stats.users.pending - stats.users.banned} tone="signal" />
                <StatCard label="動畫作品" value={stats.animeTotal} />
                <StatCard label="待審編輯" value={stats.pendingEditRequests} tone="accent" />
              </div>

              <Panel className="space-y-3">
                <p className="section-label">使用者分布</p>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="text-muted">管理員 <span className="text-signal font-mono">{stats.users.admins}</span></span>
                  <span className="text-muted">· 板務 <span className="text-signal font-mono">{stats.users.moderators}</span></span>
                  <span className="text-muted">· 成員 <span className="text-text font-mono">{stats.users.members}</span></span>
                  <span className="text-muted">· 待審核 <span className="text-text font-mono">{stats.users.pending}</span></span>
                  <span className="text-muted">· 封鎖 <span className="text-accent font-mono">{stats.users.banned}</span></span>
                </div>
              </Panel>

              <Panel className="space-y-3">
                <p className="section-label">快速操作</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => { setTab("users"); }}>權限管理 →</Button>
                  <Button variant="ghost" onClick={() => { setTab("roles"); }}>身份權限 →</Button>
                  <Button variant="ghost" onClick={() => { setTab("edits"); }}>審核動畫編輯 →</Button>
                  <Button variant="ghost" onClick={() => { setTab("activity"); }}>觀看紀錄 →</Button>
                  <a href="/api/health" target="_blank" rel="noreferrer">
                    <Button variant="ghost">API Health ↗</Button>
                  </a>
                </div>
              </Panel>

              <Panel className="space-y-3">
                <p className="section-label">資料維護</p>
                <p className="text-sm text-muted">將 DB 中舊的 AniList 封面縮圖（medium 尺寸，約 115px）升級為 large（約 230px）。執行一次即可，重複執行無害。</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="ghost"
                    disabled={busyId === "backfill:cover"}
                    onClick={async () => {
                      setBusyId("backfill:cover");
                      setBackfillResult(null);
                      try {
                        const res = await api.post<{ updated: number }>("/api/admin/panel/backfill/cover-images", {});
                        setBackfillResult(`完成，共更新 ${res.updated} 筆封面 URL。`);
                      } catch {
                        setBackfillResult("執行失敗，請確認資料庫連線正常。");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  >
                    {busyId === "backfill:cover" ? "更新中…" : "升級封面畫質"}
                  </Button>
                  {backfillResult && <p className="text-xs text-signal">{backfillResult}</p>}
                </div>
              </Panel>

              <Panel className="space-y-2">
                <p className="section-label">當前登入身分</p>
                <p className="text-sm text-text">{me?.discordGlobalName ?? me?.discordUsername}</p>
                <p className="font-mono text-xs text-muted">{me?.id}</p>
                <Badge tone={ROLE_TONE[me?.role as UserRole ?? "member"]}>{ROLE_LABEL[me?.role as UserRole ?? "member"]}</Badge>
              </Panel>
            </>
          )}
        </div>
      )}

      {tab === "users" && (
        <div data-reveal className="space-y-3">
          <p className="text-sm text-muted">這裡管理使用者身份與封鎖狀態。</p>
          {users === null ? <Loading /> : users.length === 0 ? (
            <p className="text-muted">沒有使用者資料。</p>
          ) : (
            <div className="overflow-x-auto border-y border-border/50">
              <table className="min-w-[56rem] w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-border/40">
                    <th className="py-2 pr-4 font-medium">使用者</th>
                    <th className="py-2 pr-4 font-medium">身份</th>
                    <th className="py-2 pr-4 font-medium">追番</th>
                    <th className="py-2 pr-4 font-medium">加入</th>
                    <th className="py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 pr-4">
                        <div className="font-medium text-text">{u.discordGlobalName ?? u.discordUsername}</div>
                        <div className="font-mono text-xs text-muted">@{u.discordUsername}</div>
                      </td>
                      <td className="py-2.5 pr-4"><Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge></td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-muted">{u.animeCount}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="py-2.5">
                        {u.id === me?.id ? (
                          <span className="text-xs text-muted">自己</span>
                        ) : canManageUsers ? (
                          <div className="flex flex-wrap gap-1.5">
                            {USER_ROLES.filter((r) => r !== u.role).map((r) => (
                              <Button
                                key={r}
                                variant={r === "banned" ? "danger" : "ghost"}
                                className="!py-1 !px-2 text-xs"
                                disabled={busyId === u.id}
                                onClick={() => changeRole(u.id, r)}
                              >
                                {ROLE_LABEL[r]}
                              </Button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted">沒有權限</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "roles" && (
        <div data-reveal className="space-y-3">
          <p className="text-sm text-muted">每個身份可以使用哪些功能。Owner 永遠擁有全部權限。</p>
          {roleConfigs === null ? <Loading /> : (
            <RolePermissionsEditor
              configs={roleConfigs}
              busyId={busyId}
              canManage={canManageRoles}
              onToggle={toggleRolePermission}
            />
          )}
        </div>
      )}

      {tab === "edits" && (
        <div data-reveal className="space-y-3">
          {editRequests === null ? <Loading /> : editRequests.length === 0 ? (
            <p className="text-muted">目前沒有動畫編輯提案。</p>
          ) : (
            <ul className="space-y-3">
              {editRequests.map((r) => (
                <Panel key={r.id} className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link to={`/app/anime/${r.animeId}`} className="font-medium text-text hover:text-accent">
                        {r.animeTitle ?? r.animeTitleFallback}
                      </Link>
                      <p className="font-mono text-xs text-muted">
                        {r.userName ?? "使用者"} · {new Date(r.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge tone={r.status === "approved" ? "signal" : r.status === "rejected" ? "accent" : "muted"}>
                      {r.status === "pending" ? "待審" : r.status === "approved" ? "已通過" : "已拒絕"}
                    </Badge>
                  </div>

                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    {Object.entries(r.payload).map(([key, value]) => (
                      <div key={key} className="min-w-0">
                        <dt className="section-label">{fieldLabel(key)}</dt>
                        <dd className="break-words text-text">{value == null || value === "" ? "（清空）" : String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                  {r.note && <p className="text-sm text-muted">備註：{r.note}</p>}

                  {r.status === "pending" && (
                    <div className="flex gap-2">
                      <Button disabled={busyId === r.id} onClick={() => reviewEdit(r.id, "approve")}>通過並更新</Button>
                      <Button variant="danger" disabled={busyId === r.id} onClick={() => reviewEdit(r.id, "reject")}>拒絕</Button>
                    </div>
                  )}
                </Panel>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "activity" && (
        <div data-reveal>
          {activity === null ? <Loading /> : activity.length === 0 ? (
            <p className="text-muted">沒有觀看紀錄。</p>
          ) : (
            <ul className="divide-y divide-border/40 border-y border-border/40">
              {activity.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div className="min-w-0">
                    <Link to={`/app/anime/${a.animeId}`} className="text-text hover:text-accent transition-colors">
                      {a.animeTitle ?? a.animeTitleFallback}
                    </Link>
                    <span className="ml-2 text-muted text-xs">{a.userName ?? "？"}</span>
                  </div>
                  <span className="font-mono text-xs text-muted">
                    EP{a.episodeNumber}{a.completed ? " ✓" : ""} · {new Date(a.watchedAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "audit" && (
        <div data-reveal>
          {auditLogs === null ? <Loading /> : auditLogs.length === 0 ? (
            <p className="text-muted">沒有審計紀錄。</p>
          ) : (
            <div className="overflow-x-auto border-y border-border/50">
              <table className="min-w-[46rem] w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-border/40">
                    <th className="py-2 pr-4 font-medium">時間</th>
                    <th className="py-2 pr-4 font-medium">操作者</th>
                    <th className="py-2 pr-4 font-medium">動作</th>
                    <th className="py-2 font-medium">目標</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {auditLogs.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2.5 pr-4 font-mono text-xs text-muted">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="py-2.5 pr-4 text-text">{row.actorName ?? row.actorUserId ?? "system"}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-signal">{row.action}</td>
                      <td className="py-2.5 font-mono text-xs text-muted">
                        {row.targetType ?? "-"}{row.targetId ? ` · ${row.targetId}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "announcements" && (
        <div data-reveal className="space-y-5">
          {!canManageAnnouncements ? (
            <p className="text-muted">只有管理員與擁有者可以管理公告。</p>
          ) : (
            <>
              <form onSubmit={saveAnnouncement} className="space-y-3 border-y border-border/50 py-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_9rem_9rem_7rem]">
                  <Input
                    value={announcementForm.title}
                    onChange={(e) => setAnnouncementForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="公告標題"
                    maxLength={120}
                    required
                  />
                  <Select
                    value={announcementForm.level}
                    onChange={(e) => setAnnouncementForm((f) => ({ ...f, level: e.target.value as AnnouncementLevel }))}
                  >
                    {ANNOUNCEMENT_LEVELS.map((level) => (
                      <option key={level} value={level}>{ANNOUNCEMENT_LEVEL_LABEL[level]}</option>
                    ))}
                  </Select>
                  <Select
                    value={announcementForm.audience}
                    onChange={(e) => setAnnouncementForm((f) => ({ ...f, audience: e.target.value as AnnouncementAudience }))}
                  >
                    {ANNOUNCEMENT_AUDIENCES.map((audience) => (
                      <option key={audience} value={audience}>{ANNOUNCEMENT_AUDIENCE_LABEL[audience]}</option>
                    ))}
                  </Select>
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={announcementForm.isActive}
                      onChange={(e) => setAnnouncementForm((f) => ({ ...f, isActive: e.target.checked }))}
                      className="accent-[var(--color-accent)]"
                    />
                    啟用
                  </label>
                </div>
                <Textarea
                  value={announcementForm.content}
                  onChange={(e) => setAnnouncementForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="公告內容（純文字）"
                  maxLength={2000}
                  required
                />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[12rem_12rem_auto] lg:items-end">
                  <Input
                    type="datetime-local"
                    value={announcementForm.startsAt}
                    onChange={(e) => setAnnouncementForm((f) => ({ ...f, startsAt: e.target.value }))}
                    aria-label="開始時間"
                  />
                  <Input
                    type="datetime-local"
                    value={announcementForm.endsAt}
                    onChange={(e) => setAnnouncementForm((f) => ({ ...f, endsAt: e.target.value }))}
                    aria-label="結束時間"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={busyId === "announcement:save"}>
                      {editingAnnouncementId ? "儲存公告" : "新增公告"}
                    </Button>
                    {editingAnnouncementId && (
                      <Button type="button" variant="ghost" onClick={resetAnnouncementForm}>取消</Button>
                    )}
                  </div>
                </div>
                {announcementError && (
                  <p className="text-xs text-accent">{announcementError}</p>
                )}
              </form>

              {announcements === null ? <Loading /> : announcements.length === 0 ? (
                <p className="text-muted">目前沒有公告。</p>
              ) : (
                <div className="overflow-x-auto border-y border-border/50">
                  <table className="min-w-[54rem] w-full text-left text-sm">
                    <thead className="text-xs text-muted">
                      <tr className="border-b border-border/40">
                        <th className="py-2 pr-4 font-medium">公告</th>
                        <th className="py-2 pr-4 font-medium">等級</th>
                        <th className="py-2 pr-4 font-medium">對象</th>
                        <th className="py-2 pr-4 font-medium">狀態</th>
                        <th className="py-2 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {announcements.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2.5 pr-4">
                            <div className="font-medium text-text">{item.title}</div>
                            <div className="mt-0.5 line-clamp-1 text-xs text-muted">{item.content}</div>
                          </td>
                          <td className="py-2.5 pr-4">{ANNOUNCEMENT_LEVEL_LABEL[item.level]}</td>
                          <td className="py-2.5 pr-4">{ANNOUNCEMENT_AUDIENCE_LABEL[item.audience]}</td>
                          <td className="py-2.5 pr-4 font-mono text-xs text-muted">
                            {item.isActive ? "active" : "inactive"}
                          </td>
                          <td className="py-2.5">
                            <div className="flex gap-2">
                              <button onClick={() => editAnnouncement(item)} className="text-xs text-accent">編輯</button>
                              {item.isActive && (
                                <button
                                  onClick={() => deactivateAnnouncement(item.id)}
                                  disabled={busyId === `announcement:${item.id}`}
                                  className="text-xs text-muted hover:text-accent"
                                >
                                  停用
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "test" && (
        <div data-reveal className="space-y-4">
          <Panel className="space-y-3">
            <p className="section-label">建立測試場景</p>
            <p className="text-sm text-muted">建立帶有假 Discord ID 的測試用戶，用來驗證各頁面與流程正常運作。完成後用下方清除按鈕刪除。</p>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busyId?.startsWith("test:seed")}
                onClick={() => seedTest("application")}
              >
                申請流程 → 建立待審申請
              </Button>
              <Button
                disabled={busyId?.startsWith("test:seed")}
                onClick={() => seedTest("member")}
              >
                成員流程 → 建立已核准成員
              </Button>
            </div>
            <p className="text-xs text-muted">
              「申請流程」：在審核申請頁測試 approve / reject。「成員流程」：測試成員頁面與追番功能。
            </p>
          </Panel>

          <Panel className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="section-label">目前測試用戶</p>
              <Button variant="ghost" className="!py-1 !px-2 text-xs" onClick={() => setTestUsers(null)}>
                重新整理
              </Button>
            </div>
            {testUsers === null ? <Loading /> : testUsers.length === 0 ? (
              <p className="text-sm text-muted">目前沒有測試資料。</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {testUsers.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div>
                      <span className="text-text">{u.discordGlobalName ?? u.discordUsername}</span>
                      <span className="ml-2 font-mono text-xs text-muted">{u.discordId}</span>
                    </div>
                    <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="space-y-3">
            <p className="section-label">清除測試資料</p>
            <p className="text-sm text-muted">刪除所有測試用戶及其相關資料（申請、追番紀錄等）。不可復原。</p>
            <Button
              variant="danger"
              disabled={busyId === "test:cleanup" || testUsers?.length === 0}
              onClick={cleanupTest}
            >
              清除所有測試資料 {testUsers !== null && testUsers.length > 0 ? `(${testUsers.length})` : ""}
            </Button>
          </Panel>
        </div>
      )}

      {tab === "discord" && (
        <div data-reveal className="space-y-4">
          <Panel className="space-y-3">
            <p className="section-label">設定狀態</p>
            {discordStatus === null ? <Loading /> : (
              <ul className="space-y-1.5 text-sm">
                <DiscordStatusRow label="Bot Token" ok={discordStatus.botToken} />
                <DiscordStatusRow label="Guild ID" ok={discordStatus.guildId} />
                <DiscordStatusRow label="Interactions Public Key（可選）" ok={discordStatus.publicKey} />
                <DiscordStatusRow label="通知頻道 ID" ok={discordStatus.notificationChannelId} />
              </ul>
            )}
            <p className="text-xs text-muted">
              未設定的項目請在 <span className="font-mono">.dev.vars</span>（本地）或 <span className="font-mono">wrangler.jsonc vars</span>（非機密）填入。
              Bot Token 在 Discord Developer Portal → Bot → Token。
            </p>
          </Panel>

          <Panel className="space-y-3">
            <p className="section-label">個人化通知</p>
            <p className="text-sm text-muted">
              Phase 4 主線改成個人化通知：用 Cron + Discord REST API 送出每日 DM，內容依每個人的追番清單、優先度與最近觀看紀錄整理。
              社群頻道摘要只使用成員主動公開的追番資料，避免把私人進度丟到公開頻道。
            </p>
            <p className="text-xs text-muted">
              使用者可在設定頁自行開啟每日 DM 並寄送測試訊息；未 opt-in 的成員不會收到自動通知。
            </p>
          </Panel>

          <Panel className="space-y-3">
            <p className="section-label">可選互動入口</p>
            <p className="text-sm text-muted">
              將 <span className="font-mono">/anime</span>（today / watching / share）指令註冊到 Discord。
              這是 stateless HTTP Interactions，不需要 Gateway 長連線；但它不再是 Phase 4 主線，只當作低優先查詢入口保留。
            </p>
            <Button
              variant="ghost"
              disabled={busyId === "discord:register" || !discordStatus?.botToken}
              onClick={async () => {
                setBusyId("discord:register");
                setDiscordRegisterResult(null);
                try {
                  const result = await api.post<{ scope: "guild" | "global"; status: number }>("/api/admin/panel/discord/register-commands", {});
                  setDiscordRegisterResult(
                    result.scope === "guild"
                      ? "已送出伺服器指令註冊。若 Discord 仍看不到，請確認 bot 邀請時有勾 application.commands scope。"
                      : "已送出 global 指令註冊。Discord 可能需要一段時間才會同步到伺服器。",
                  );
                } finally {
                  setBusyId(null);
                }
              }}
            >
              {busyId === "discord:register" ? "註冊中…" : "註冊 Slash 指令"}
            </Button>
            {!discordStatus?.botToken && (
              <p className="text-xs text-accent">需要先設定 DISCORD_BOT_TOKEN。</p>
            )}
            {discordRegisterResult && <p className="text-xs text-signal">{discordRegisterResult}</p>}
            <p className="text-xs text-muted">
              Discord Developer Portal 的 OAuth2 Redirects 是登入 callback，應填 <span className="font-mono">/api/auth/discord/callback</span>。
              Slash command 的 HTTP 入口要填在 General Information → Interactions Endpoint URL：<span className="font-mono">{window.location.origin}/api/discord/interactions</span>。
            </p>
          </Panel>

          <Panel className="space-y-2">
            <p className="section-label">每日摘要 Cron</p>
            <p className="text-sm text-muted">
              每天 09:00 UTC 自動把社群追番動態發到 <span className="font-mono">DISCORD_NOTIFICATION_CHANNEL_ID</span> 指定頻道。
              Bot 必須在該頻道有發送訊息的權限；摘要只會列出成員主動公開的追番紀錄。個人 DM 只寄給已開啟每日私訊的成員。
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
}

function DiscordStatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span className={ok ? "text-signal" : "text-accent"} aria-hidden>{ok ? "✓" : "✗"}</span>
      <span className={ok ? "text-text" : "text-muted"}>{label}</span>
      {!ok && <span className="text-xs text-muted">（未設定）</span>}
    </li>
  );
}

function fieldLabel(key: string) {
  return ({
    title: "主標題",
    titleZh: "中文名稱",
    titleJp: "日文名稱",
    description: "介紹",
    coverImageUrl: "封面 URL",
    episodesTotal: "總集數",
  } as Record<string, string>)[key] ?? key;
}

function RolePermissionsEditor({
  configs,
  busyId,
  canManage,
  onToggle,
}: {
  configs: RolePermissionConfig[];
  busyId: string | null;
  canManage: boolean;
  onToggle: (role: UserRole, permission: RolePermission, checked: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      {USER_ROLES.map((role) => {
        const config = configs.find((item) => item.role === role);
        const enabled = new Set(config?.permissions ?? []);
        const locked = role === "owner" || !canManage;
        return (
          <Panel key={role} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Badge>
                <span className="font-mono text-xs text-muted">{role}</span>
              </div>
              {role === "owner" && <span className="text-xs text-muted">固定全權限</span>}
              {role !== "owner" && !canManage && <span className="text-xs text-muted">沒有身份權限編輯權限</span>}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {ROLE_PERMISSIONS.map((permission) => (
                <label key={permission} className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-sm text-text">
                  <input
                    type="checkbox"
                    className="accent-[var(--color-accent)]"
                    checked={role === "owner" || enabled.has(permission)}
                    disabled={locked || busyId === `role:${role}`}
                    onChange={(event) => onToggle(role, permission, event.target.checked)}
                  />
                  <span>{ROLE_PERMISSION_LABELS[permission]}</span>
                </label>
              ))}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "accent" | "signal";
}) {
  const color = tone === "accent" ? "text-accent" : tone === "signal" ? "text-signal" : "text-text";
  return (
    <Panel className="space-y-1">
      <p className="section-label">{label}</p>
      <p className={`text-2xl font-semibold font-mono ${color}`}>{value}</p>
    </Panel>
  );
}
