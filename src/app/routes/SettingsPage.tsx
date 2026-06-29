import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtDateTime } from "../lib/date";
import { useAuth } from "../lib/auth";
import { Button, Badge } from "../components/ui";
import { useReveal } from "../lib/motion";
import { api, ApiError } from "../lib/api";
import type { NotificationSettings } from "../../shared/types";

const roleLabel: Record<string, string> = {
  owner: "Owner（站長）",
  admin: "Admin（管理員）",
  moderator: "Moderator（板務）",
  member: "Member（成員）",
  pending: "Pending（待審核）",
  banned: "Banned（停權）",
};

export function SettingsPage() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const scope = useReveal<HTMLDivElement>();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [draft, setDraft] = useState<NotificationSettings | null>(null);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"signal" | "accent">("signal");

  useEffect(() => {
    api
      .get<NotificationSettings>("/api/me/notification-settings")
      .then((value) => {
        setSettings(value);
        setDraft(value);
      })
      .catch(() => undefined);
  }, []);

  async function saveNotificationSettings() {
    if (!draft) return;
    setBusy("save");
    setMessage(null);
    try {
      const updated = await api.patch<NotificationSettings>("/api/me/notification-settings", {
        dailyDmEnabled: draft.dailyDmEnabled,
        dailyDmIncludeCommunity: draft.dailyDmIncludeCommunity,
      });
      setSettings(updated);
      setDraft(updated);
      setMessageTone("signal");
      setMessage("通知偏好已儲存。");
    } catch (err) {
      setMessageTone("accent");
      setMessage(err instanceof ApiError ? err.message : "通知偏好儲存失敗。");
    } finally {
      setBusy(null);
    }
  }

  async function sendTestDm() {
    setBusy("test");
    setMessage(null);
    try {
      await api.post("/api/me/notification-settings/test-dm", {});
      setMessageTone("signal");
      setMessage("測試 DM 已送出。");
    } catch (err) {
      setMessageTone("accent");
      setMessage(err instanceof ApiError ? err.message : "測試 DM 發送失敗。");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={scope} className="mx-auto max-w-3xl">
      <header data-reveal className="mb-8 border-b border-border/50 pb-6">
        <p className="section-label">帳號設定</p>
        <h1 className="mt-1 text-2xl font-semibold text-text">設定</h1>
      </header>

      <div className="grid gap-10 lg:grid-cols-[15rem_1fr] lg:gap-14">
        {/* Identity sidebar */}
        <aside data-reveal className="space-y-5 lg:pt-0.5">
          <div>
            <p className="section-label mb-2">Discord 帳號</p>
            <div className="text-text">{me?.discordGlobalName ?? me?.discordUsername}</div>
            <div className="mt-0.5 font-mono text-xs text-muted">@{me?.discordUsername}</div>
            {me && <div className="mt-3"><Badge tone="accent">{roleLabel[me.role] ?? me.role}</Badge></div>}
          </div>
          <Button variant="ghost" onClick={() => logout().then(() => navigate("/"))}>
            登出
          </Button>
        </aside>

        {/* Settings sections */}
        <div data-reveal className="divide-y divide-border/40">
          {/* Notifications */}
          <section className="space-y-4 pb-8">
            <div>
              <h2 className="font-medium text-text">個人化通知</h2>
              <p className="mt-1 text-sm text-muted">
                不需要額外架 Discord bot。系統會用 Cloudflare Cron 定時醒來，透過 Discord REST API 把你的今日追番簡報私訊給你。
              </p>
            </div>

            {draft === null ? (
              <p className="text-sm text-muted">讀取通知設定中…</p>
            ) : (
              <>
                <div className="space-y-3">
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-[var(--color-accent)]"
                      checked={draft.dailyDmEnabled}
                      onChange={(e) => setDraft({ ...draft, dailyDmEnabled: e.target.checked })}
                    />
                    <span>
                      <span className="block text-text">每日私訊追番簡報</span>
                      <span className="text-xs text-muted">每天 09:00 UTC 依你的追番清單整理「接著看」與最近觀看紀錄</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-[var(--color-accent)]"
                      checked={draft.dailyDmIncludeCommunity}
                      onChange={(e) => setDraft({ ...draft, dailyDmIncludeCommunity: e.target.checked })}
                    />
                    <span>
                      <span className="block text-text">簡報中附上社群公開動態</span>
                      <span className="text-xs text-muted">只會包含成員主動公開的追番紀錄，不會公開你的私人進度</span>
                    </span>
                  </label>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    disabled={busy === "save" || !settings || (
                      settings.dailyDmEnabled === draft.dailyDmEnabled &&
                      settings.dailyDmIncludeCommunity === draft.dailyDmIncludeCommunity
                    )}
                    onClick={saveNotificationSettings}
                  >
                    {busy === "save" ? "儲存中…" : "儲存"}
                  </Button>
                  <Button variant="ghost" disabled={busy === "test"} onClick={sendTestDm}>
                    {busy === "test" ? "發送中…" : "寄送測試 DM"}
                  </Button>
                </div>

                {draft.dailyDmLastSentAt && (
                  <p className="text-xs text-muted">上次每日簡報：{fmtDateTime(draft.dailyDmLastSentAt)}</p>
                )}
                {message && (
                  <p className={`text-xs ${messageTone === "signal" ? "text-signal" : "text-accent"}`}>{message}</p>
                )}
              </>
            )}
          </section>

          {/* Browser extension */}
          <section className="space-y-4 pt-8">
            <div>
              <h2 className="font-medium text-text">瀏覽器插件</h2>
              <p className="mt-1 text-sm text-muted">在巴哈動畫瘋或 anime1.me 看番時，插件會自動偵測進度並同步回來。</p>
            </div>

            <div className="space-y-1.5 text-sm text-muted">
              <p className="font-medium text-text">安裝步驟</p>
              <ol className="list-inside list-decimal space-y-1.5 pl-0.5">
                <li>在 Chrome / Edge 開啟 <span className="kbd-label">chrome://extensions</span></li>
                <li>開啟右上角「開發人員模式」</li>
                <li>點「載入未封裝項目」，選擇專案內的 <span className="kbd-label">extension/</span> 目錄</li>
                <li>插件圖示出現在工具列後，點選並開啟設定</li>
                <li>將 API 網址填入 <span className="kbd-label">https://aon.tinyyana.com</span>，儲存後測試連線</li>
              </ol>
            </div>

            <div className="space-y-1 text-sm text-muted">
              <p className="font-medium text-text">支援平台</p>
              <ul className="list-inside list-disc space-y-0.5 pl-0.5">
                <li>巴哈姆特動畫瘋（ani.gamer.com.tw）</li>
                <li>anime1.me</li>
              </ul>
            </div>

            <p className="text-xs text-muted/60">安裝前請先在本站完成 Discord 登入，插件才能讀取到登入狀態。</p>
          </section>
        </div>
      </div>
    </div>
  );
}
