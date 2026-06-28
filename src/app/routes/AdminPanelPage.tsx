import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Panel, Button, Badge, Loading } from "../components/ui";
import { useReveal } from "../lib/motion";
import { hasPermission, useAuth } from "../lib/auth";
import { ROLE_PERMISSION_LABELS, ROLE_PERMISSIONS, USER_ROLES } from "../../shared/types";
import type { AnimeEditRequest, RolePermission, RolePermissionConfig, UserRole } from "../../shared/types";

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

type TestUser = {
  id: string;
  discordId: string;
  discordUsername: string;
  discordGlobalName: string | null;
  role: UserRole;
  createdAt: string;
};

type DiscordStatus = { botToken: boolean; guildId: boolean; publicKey: boolean; notificationChannelId: boolean };
type Tab = "stats" | "users" | "roles" | "edits" | "activity" | "test" | "discord";

export function AdminPanelPage() {
  const { me, refetch } = useAuth();
  const [tab, setTab] = useState<Tab>("stats");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [roleConfigs, setRoleConfigs] = useState<RolePermissionConfig[] | null>(null);
  const [editRequests, setEditRequests] = useState<AnimeEditRequest[] | null>(null);
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testUsers, setTestUsers] = useState<TestUser[] | null>(null);
  const [discordStatus, setDiscordStatus] = useState<DiscordStatus | null>(null);
  const canManageRoles = hasPermission(me, "roles.manage");
  const canManageUsers = hasPermission(me, "users.manage");

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
    if (tab === "edits" && editRequests === null) {
      api.get<AnimeEditRequest[]>("/api/admin/panel/edit-requests").then(setEditRequests).catch(() => setEditRequests([]));
    }
    if (tab === "test" && testUsers === null) {
      api.get<TestUser[]>("/api/admin/panel/test/users").then(setTestUsers).catch(() => setTestUsers([]));
    }
    if (tab === "discord" && discordStatus === null) {
      api.get<DiscordStatus>("/api/admin/panel/discord/status").then(setDiscordStatus).catch(() => undefined);
    }
  }, [tab, users, roleConfigs, activity, editRequests, testUsers, discordStatus]);

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
        {tabBtn("test", "測試")}
        {tabBtn("discord", "Discord")}
      </nav>

      {tab === "stats" && (
        <div data-reveal className="space-y-6">
          {stats === null ? <Loading /> : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="總使用者" value={stats.users.total} />
                <StatCard label="正式成員" value={stats.users.members} tone="signal" />
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
            <ul className="space-y-2">
              {users.map((u) => (
                <Panel key={u.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text">
                        {u.discordGlobalName ?? u.discordUsername}
                      </span>
                      <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                    </div>
                    <p className="font-mono text-xs text-muted mt-0.5">
                      @{u.discordUsername} · {u.animeCount} 部番 · 加入 {new Date(u.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {u.id !== me?.id && canManageUsers && (
                    <div className="flex flex-wrap gap-1.5">
                      {USER_ROLES
                        .filter((r) => r !== u.role)
                        .map((r) => (
                          <Button
                            key={r}
                            variant={r === "banned" ? "danger" : "ghost"}
                            className="!py-1 !px-2.5 text-xs"
                            disabled={busyId === u.id}
                            onClick={() => changeRole(u.id, r)}
                          >
                            {ROLE_LABEL[r]}
                          </Button>
                        ))}
                    </div>
                  )}
                  {u.id !== me?.id && !canManageUsers && (
                    <span className="text-xs text-muted">沒有使用者管理權限</span>
                  )}
                  {u.id === me?.id && (
                    <span className="text-xs text-muted">（自己）</span>
                  )}
                </Panel>
              ))}
            </ul>
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
                <DiscordStatusRow label="Public Key（指令驗簽）" ok={discordStatus.publicKey} />
                <DiscordStatusRow label="通知頻道 ID" ok={discordStatus.notificationChannelId} />
              </ul>
            )}
            <p className="text-xs text-muted">
              未設定的項目請在 <span className="font-mono">.dev.vars</span>（本地）或 <span className="font-mono">wrangler.jsonc vars</span>（非機密）填入。
              Bot Token 在 Discord Developer Portal → Bot → Token。
            </p>
          </Panel>

          <Panel className="space-y-3">
            <p className="section-label">Slash 指令</p>
            <p className="text-sm text-muted">
              將 <span className="font-mono">/anime</span>（today / watching / share）指令註冊到 Discord。
              需要先設定好 Bot Token 和 Interactions Endpoint URL（Discord Developer Portal → General → Interactions Endpoint URL 填 <span className="font-mono">{window.location.origin}/api/discord/interactions</span>）。
            </p>
            <Button
              disabled={busyId === "discord:register" || !discordStatus?.botToken}
              onClick={async () => {
                setBusyId("discord:register");
                try {
                  await api.post("/api/admin/panel/discord/register-commands", {});
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
          </Panel>

          <Panel className="space-y-2">
            <p className="section-label">每日摘要 Cron</p>
            <p className="text-sm text-muted">
              每天 09:00 UTC 自動把社群追番動態發到 <span className="font-mono">DISCORD_NOTIFICATION_CHANNEL_ID</span> 指定頻道。
              Bot 必須在該頻道有發送訊息的權限。
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
