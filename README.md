# 追番進行式 · AnimeOwatteiNai

<p align="center">
  <img src="public/logo-nobg.png" alt="追番進行式 Logo" width="120" />
</p>

> 追番永遠追不完，所以讓系統記得你看到哪。

彼岸花 Discord 社群限定、申請制的追番管理中樞。Discord 登入、成員審核、追番進度、觀看入口就這樣。沒有播放器、沒有 AI 推薦。

`source_links` 只存使用者貼進來的 URL，系統不去抓連結背後的東西。

---

## 為什麼要做這個

Discord 頻道的追番記錄散落在訊息裡，找不回來，也沒辦法知道群組整體在看什麼。做一個給自己人用的內部工具比找現有服務再適配容易得多。

申請制不是為了麻煩人，是因為開放就會變成維護負擔。

---

## Tech Stack

| 層 | 技術 |
|---|---|
| Runtime | Cloudflare Workers |
| Frontend | Vite + React + TypeScript |
| API | Hono |
| Database | Neon Postgres + Drizzle ORM |
| Auth | Discord OAuth2 |
| Cache | Cloudflare KV（外部 metadata，TTL 5 分鐘） |
| Validation | Zod |
| Styling | Tailwind CSS v4 |

前端 SPA 與 Worker API 在同一個 Worker 裡。`/api/*` 給 Hono，其餘吐 SPA。

---

## 本地開發

### 需要準備

- Node.js 20+、pnpm 9+
- Neon PostgreSQL 帳號（建立免費 Project 即可）
- Discord 開發者帳號（建立 Application + Bot）
- Cloudflare 帳號（Workers + KV，免費方案夠用）

### 安裝

```bash
pnpm install
cp .env.example .env             # 給 drizzle-kit 用
cp .dev.vars.example .dev.vars   # 給 wrangler dev 用
```

產生 SESSION_SECRET（至少 32 bytes 的高熵隨機字串）：

```bash
openssl rand -hex 32
```

### 建資料表

```bash
pnpm db:migrate
```

### 啟動

```bash
# 全棧（最接近正式環境，預設）
pnpm build && pnpm dev   # → http://localhost:8787

# 前端 HMR + 後端分開（改前端比較快）
pnpm dev        # 終端機 1：Worker / API（:8787）
pnpm dev:web    # 終端機 2：Vite HMR（:5173，自動 proxy /api 到 :8787）
```

本地開發不需要事先建 Cloudflare KV namespace，wrangler 會自動用本地模擬。

---

## 完整部署指南

### 一、Discord Application 設定

1. 前往 [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**
2. 左側 **OAuth2** → 記下 **Client ID**，按「Reset Secret」取得 **Client Secret**
3. 在「Redirects」新增：
   - `http://localhost:8787/api/auth/discord/callback`（本地開發）
   - `https://your-domain.com/api/auth/discord/callback`（生產）
4. 左側 **Bot** → **Add Bot** → 取得 **Bot Token**
   - 必須開啟 **SERVER MEMBERS INTENT**（Settings → Privileged Gateway Intents）
   - 這個 Token 讓 Worker 可以定期稽核成員是否還在伺服器內
5. 將 Bot 加入你的 Discord 伺服器（只需要 `bot` scope，Permissions 留空即可）
6. 在伺服器設定 → 一般，複製**伺服器 ID**（需開啟 Discord 開發者模式）

### 二、Neon PostgreSQL 設定

1. 前往 [neon.tech](https://neon.tech) → 建立 Project
2. 複製 **Pooled connection string**（格式：`postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require&pgbouncer=true`）
3. 在 Neon Console 的 SQL Editor 執行：

```sql
CREATE SCHEMA IF NOT EXISTS aon;
```

Drizzle 遷移會把所有資料表建在 `aon` schema 下。

### 三、Cloudflare KV Namespace

KV 用於快取外部 metadata API 回應（AniList / Bangumi / Jikan），不設的話 Worker 啟動會找不到 binding。

```bash
# 登入 Cloudflare（第一次執行）
pnpm wrangler login

# 建立 KV namespace
pnpm wrangler kv namespace create METADATA_CACHE
```

輸出類似：
```
✅ Success! Created KV namespace "anime-owatteinai-METADATA_CACHE"
id = "abcdef1234567890abcdef1234567890"
```

把 `id` 更新到 `wrangler.jsonc`：

```jsonc
"kv_namespaces": [
  {
    "binding": "METADATA_CACHE",
    "id": "abcdef1234567890abcdef1234567890",
    "preview_id": "abcdef1234567890abcdef1234567890"
  }
]
```

### 四、wrangler.jsonc 生產設定

`vars` 區塊改為你的生產值（非 secret，可放在 `wrangler.jsonc`）：

```jsonc
"vars": {
  "APP_BASE_URL": "https://your-domain.com",
  "DISCORD_REDIRECT_URI": "https://your-domain.com/api/auth/discord/callback",
  "DISCORD_CLIENT_ID": "你的 Client ID",
  "ADMIN_DISCORD_IDS": "你的 Discord User ID",
  "DISCORD_GUILD_ID": "你的伺服器 ID"
}
```

### 五、設定生產環境 Secrets

Secrets 加密儲存在 Cloudflare，不會進 git 或 `wrangler.jsonc`：

```bash
pnpm wrangler secret put DATABASE_URL          # Neon pooled connection string
pnpm wrangler secret put DISCORD_CLIENT_SECRET # Discord OAuth Client Secret
pnpm wrangler secret put SESSION_SECRET        # openssl rand -hex 32
pnpm wrangler secret put DISCORD_BOT_TOKEN     # Discord Bot Token
```

每個指令會互動式提示輸入值。

### 六、執行資料庫遷移

```bash
pnpm db:migrate
```

`DATABASE_URL` 從 `.env` 讀取（drizzle-kit 直接連 Neon，不走 Worker）。

### 七、部署

```bash
pnpm db:migrate   # 若有新 migration 先跑
pnpm deploy       # pnpm build && wrangler deploy
```

部署成功後會輸出 Workers 網址（`https://anime-owatteinai.your-account.workers.dev`）。

### 八、自訂網域（選用）

如果網域在 Cloudflare 管理：

1. Cloudflare Dashboard → **Workers & Pages** → `anime-owatteinai` → **Settings** → **Domains & Routes**
2. **Add Custom Domain** → 輸入 `your-domain.com`
3. Cloudflare 自動建立 DNS 記錄與 TLS 憑證，幾分鐘內生效

### 九、Discord Redirect URI 更新

自訂網域設定好後，記得同步更新：
- Discord Developer Portal → OAuth2 → 新增正式網域的 callback URL
- `wrangler.jsonc` → `DISCORD_REDIRECT_URI`（或重新 `wrangler secret put`）

### 十、首次登入

1. 用 `ADMIN_DISCORD_IDS` 裡設定的帳號完成 Discord 登入
2. 系統會自動設為 `owner` 角色
3. 前往 `/app/admin/applications` 開始審核申請

---

## 瀏覽器插件安裝

1. Chrome / Edge → `chrome://extensions`
2. 右上角開啟「開發人員模式」
3. 「載入未封裝項目」→ 選 `extension/` 目錄
4. 點工具列圖示 → 開啟設定 → 填入 Workers 網址（例如 `https://your-domain.com`）→ 儲存 → 測試連線

**支援平台：** 巴哈姆特動畫瘋（`ani.gamer.com.tw`）、anime1.me

---

## Scripts

| script | 作用 |
|---|---|
| `pnpm dev` | wrangler dev |
| `pnpm dev:web` | Vite HMR（代理 /api 到 :8787） |
| `pnpm build` | 建置 SPA |
| `pnpm deploy` | build + deploy |
| `pnpm db:generate` | 由 schema 產生 migration |
| `pnpm db:migrate` | 套用 migration |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm typecheck` | tsc --noEmit |
| `pnpm audit` | dependency 安全掃描 |

---

## 角色

```
owner > admin > moderator > member > pending > banned
```

- `pending`：只能查申請狀態、送申請
- `member`：追番、記錄觀看、送 edit request
- `moderator`：預設可審核申請、管理動畫資料、查看審計紀錄
- `admin`：審核申請、管理 source link、alias、anime
- `owner`：全部，且不會被角色權限設定移除權限
- `banned`：什麼都不行，session 也立即失效

Admin Panel 的「身份權限」分頁可調整各身份實際擁有哪些權限。

---

## Privacy model

追番進行式預設保守：追番清單、觀看紀錄、watch session、activity event、作品短評都先當成 private。

- `private`：只有本人能看。`/api/my/activity` 只回自己的 private events。
- `community`：使用者主動選擇後，彼岸花成員可見。短評可選 community，但預設 private。
- `system`：登入、申請審核、公告管理、通知建立等系統紀錄，用於管理與審計，不做公開動態牆。
- `public`：目前沒有 UI，先不開放。

社群聚合只回傳統計數字，例如公開追番人數、近期公開進度更新次數、community 短評數；不回傳誰看了第幾集、不回傳 private note、不做公開個人動態。

---

## 安全

Session 是 stateless HMAC-SHA256 簽章 cookie，每個 request 都重載使用者，所以 ban / 角色變更立即生效。

Rate limiting 保護了 search、import、watch session、申請送出、OAuth callback。Audit log 記錄敏感操作，IP 只存 hash 不存明文。

手動測試步驟在 `docs/security-test-checklist.md`。

---

## 授權

本專案以 [TinyYana Universal Software License (TYUSL) v1.0](LICENSE) 授權發布。個人使用、非商業用途與學習目的均可自由使用與修改。商業授權請聯繫 admin@tinyyana.com。

---

## 著作權聲明

本工具呈現的動漫作品名稱、劇情相關資訊，其著作權均屬原始權利人所有。本專案不代管、不嵌入、不下載任何影片內容，「觀看入口」僅為使用者自行提供的外部連結。

---

## AI 生成圖像聲明

本專案所使用的 Icon、Logo 與標準字，均由 ChatGPT（OpenAI）生成，僅作為社群工具之視覺識別，不作商業用途。

---

## 免責聲明

本服務以現況（as-is）提供，不保證服務穩定性、資料完整性或不中斷運作。使用者因使用本服務產生的任何直接或間接損失，本服務恕不負責。本服務得隨時修改、暫停或終止。
