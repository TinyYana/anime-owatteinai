import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Panel, Button, Badge } from "../components/ui";
import { useReveal } from "../lib/motion";

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

  return (
    <div ref={scope} className="mx-auto max-w-lg space-y-6">
      <header data-reveal>
        <p className="section-label">帳號設定</p>
        <h1 className="mt-1 text-2xl font-semibold text-text">設定</h1>
      </header>

      <Panel data-reveal className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="section-label">Discord 帳號</div>
            <div className="mt-1 text-text">{me?.discordGlobalName ?? me?.discordUsername}</div>
            <div className="font-mono text-xs text-muted">@{me?.discordUsername}</div>
          </div>
          {me && <Badge tone="accent">{roleLabel[me.role] ?? me.role}</Badge>}
        </div>
      </Panel>

      <Panel data-reveal className="space-y-4">
        <div>
          <div className="section-label mb-1">瀏覽器插件</div>
          <p className="text-sm text-muted">在巴哈動畫瘋或 anime1.me 看番時，插件會自動偵測進度並同步回來。</p>
        </div>
        <div className="space-y-2 text-sm text-muted">
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
      </Panel>

      <Button variant="ghost" onClick={() => logout().then(() => navigate("/"))}>
        登出
      </Button>
    </div>
  );
}
