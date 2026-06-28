# CLAUDE.md — anime-owatteinai

Claude Code 在此專案的指導文件。**優先級高於全域 CLAUDE.md**，但全域規則的安全、secret、git 限制仍完全適用。

---

## 專案概覽

**追番進行式（AnimeOwatteiNai）**：彼岸花 Discord 社群的私人申請制追番工具。記錄看到哪集、接下來看哪部、從哪個入口看。

- **不是**影片平台。不代管、不嵌入、不下載任何影片。
- `source_links` 只存使用者提供的 URL，系統不抓連結背後的內容。
- 採申請制，成員需在 Discord 社群才能申請。

---

## 技術棧

| 層 | 技術 |
|----|------|
| Runtime | Cloudflare Workers（Hono） |
| Frontend | Vite + React 18 + TypeScript |
| Database | Neon PostgreSQL + Drizzle ORM（`aon` schema） |
| Auth | Discord OAuth2 + HMAC-SHA256 stateless cookie |
| Cache | Cloudflare KV（外部 metadata，TTL 快取） |
| Styling | Tailwind CSS v4（custom theme，無 JIT config 檔） |
| Animation | GSAP 3 + `@gsap/react`（useGSAP hook） |
| Validation | Zod（shared validators） |
| Extension | Browser MV3（content scripts + popup + options） |

前端 SPA 與 Worker API 在同一個 Worker 裡。`/api/*` 給 Hono，其餘吐 SPA（`not_found_handling: single-page-application`）。

---

## 檔案結構重點

```
src/
  app/                  React SPA
    components/
      ui.tsx            所有共用 UI 元件（Panel, Button, Badge, ProgressRail…）
      AppLayout.tsx     登入後的 nav + layout wrapper
      ThemeToggle.tsx   GSAP 動畫 sun↔moon 切換
    lib/
      auth.tsx          useAuth hook, RequireApp/RequireAdmin
      motion.ts         EASE, DUR, useReveal hook（統一入場動畫）
      api.ts            fetch wrapper（api.get/post/patch/del）
      watch.ts          markEpisodeWatched()（一鍵看完核心邏輯）
      theme.ts          localStorage 主題初始化
    routes/             各頁面元件
    styles/index.css    Tailwind @theme + 全域樣式
  worker/               Cloudflare Worker（Hono API）
  db/                   Drizzle schema + migrations
  shared/               types.ts, validators.ts（前後端共用）
extension/              瀏覽器插件（MV3）
public/                 靜態資產（robots.txt, og-image.svg）
```

---

## UI 設計規範

### 美學方向：輕百合・日常向

- 暖紫玫瑰色系。深色「午夜薰衣草」，淺色「櫻花日光」。
- 不是終端機風格、不是 SaaS 白板。有點 ACG 感、咖啡廳平靜感。

### 色彩（來自 `index.css @theme`）

| Token | 深色 | 淺色 |
|-------|------|------|
| `--color-accent` | `#e8699a` | `#c44072` |
| `--color-signal` | `#70cbb8` | `#2e9080` |
| `--color-muted` | `#9586b0` | `#7a6090` |
| `--color-text` | `#ede8f4` | `#1a1028` |

### 元件規範

- **Panel**：`rounded-xl`，`border border-border/60`，`bg-panel/85`，有 `.elev` shadow。
- **Button**：`rounded-lg`，primary = accent 背景，ghost = 透明邊框，danger = accent 文字。
- **Badge**：`rounded-full`（pill），tone = muted/accent/signal。
- **`.section-label`**：區塊標籤樣式。暖色、不大寫、不 mono。
- **`.kbd-label`**：技術 metadata 用（集數、日期、外部 ID）。mono，小字。
- **永遠不要用 `//` 前綴的標籤風格** — 移除過、不要再加回來。

### 彼岸花（higanbana）紋路

- `.higanbana` CSS class：純 CSS conic+radial 六瓣花紋，是這個專案的視覺識別。
- 只作背景裝飾，永遠不作內容、不加 alt text。
- 目前出現在：Landing page 左上、AppLayout nav 標誌旁。

### Progress Rail

- `.rail` 是「看到哪」的簽名元素。signal→accent 漸層。
- 用 `<ProgressRail current={n} total={m} />` 元件（ui.tsx）。
- Landing page 也有一個靜態示意版。

---

## 動畫規範（motion.ts）

```ts
EASE = "power3.out"   // 所有品牌動畫的標準緩動
DUR  = { quick: 0.18, base: 0.32, slow: 0.6 }
```

### 頁面入場：useReveal

```tsx
const scope = useReveal<HTMLDivElement>([deps]);
// 然後在元素上加 data-reveal
<div data-reveal>...</div>
```

- `useReveal` 內部做 reduced-motion 檢查，不用自己判斷。
- 所有主要頁面（ApplyPage, SettingsPage, DashboardPage…）都用這個模式。

### GSAP 限制

- 只在 `useGSAP` hook 裡執行 GSAP 動畫（有自動 cleanup）。
- 必須 `gsap.registerPlugin(useGSAP)` 在元件檔案頂層。
- 動畫完成後 `clearProps: "opacity,transform"` 清掉行內樣式，避免干擾 CSS。

---

## 文案規範

### 句號使用

- **空狀態 hint、短標籤、列表項目**：不加句號（例：「還沒有觀看紀錄」）
- **完整說明句、多句段落**：加句號（例：「申請已送出，管理員審核通過後即可進入。」）
- **錯誤訊息**：加句號（例：「送出失敗，請稍後再試。」）
- **按鈕文字、導航標籤**：不加句號

### 語氣

- 面向成員的文字：輕鬆、直接，不要過度正式。
- 用繁體中文，不混入簡體。
- 技術術語保持中文（例：「集數」「觀看入口」「追番清單」）。

---

## 後端重要規則

### Auth

- Session 是 stateless HMAC-SHA256 cookie（`aon_session`）。
- 每個 request 都從 DB 重載使用者，ban/角色變更立即生效。
- 角色體系：`owner > admin > moderator > member > pending > banned`。
- `ADMIN_DISCORD_IDS` 裡的帳號第一次登入自動升為 `owner`。

### Source Links

- 只有 `admin` / `owner` 可以新增或刪除 source links。
- `member` 只能看、點。
- 系統不抓連結內容，只存 URL。

### markEpisodeWatched

`src/app/lib/watch.ts` 的 `markEpisodeWatched(animeId, episodeNumber)` 是「看完一集」的核心。它 post 一筆 completed watch-session，server 自動更新 `currentEpisode`。**所有「看完」操作都要走這個函式**，不要自己 patch currentEpisode。

### Metadata 來源優先順序

1. AniList GraphQL（主要）
2. Bangumi API（中文名補充，CJK 查詢觸發）
3. Jikan/MAL（AniList 回空時的 fallback）

---

## 常用指令

```bash
pnpm dev          # 全棧開發（Worker + SPA，localhost:8787）
pnpm dev:web      # 只跑 Vite HMR（localhost:5173）
pnpm build        # 建置 SPA 到 dist/client/
pnpm deploy       # build + wrangler deploy
pnpm db:migrate   # 執行 Drizzle 遷移
pnpm db:studio    # 開啟 Drizzle Studio
pnpm typecheck    # tsc --noEmit
```

---

## 建議使用的 Skills

| 情況 | Skill |
|------|-------|
| 任何 coding 任務（模糊需求或有 bug 風險） | `careful-coding` |
| UI 層級、視覺複雜度、資訊架構問題 | `ui-complexity` |
| 新增頁面或大幅重設計 | `ui-art-direction` → `ui-refactoring` |
| 加動畫或修改現有動畫 | `gsap-react`、`motion-design` |
| 寫或修改繁體中文文案 | `tinyyana-speaking-style` |
| 安全性審查 | `engineering-security-engineer` |

---

## 停止條件（需確認才能繼續）

- 新增 npm 依賴（先確認現有依賴能否解決）
- 修改 Drizzle schema（會產生不可逆 migration）
- 變更 Discord OAuth redirect URI（影響所有現有登入）
- 刪除任何 migration 檔案
- 修改 session cookie 邏輯（可能讓所有人登出）
- 修改角色權限體系

---

## 授權

TYUSL v1.0（TinyYana Universal Software License）。詳見 LICENSE 檔案。
