# AGENTS.md — anime-owatteinai

AI Agent 在此專案的指導文件。與 CLAUDE.md 內容相同，保持同步。

---

## 專案概覽

**追番進行式（AnimeOwatteiNai）**：彼岸花 Discord 社群的私人申請制追番工具。

- 申請制，需要在 Discord 社群內才能加入
- 不代管、不嵌入、不下載任何影片。source_links 只存 URL
- 部署於 Cloudflare Workers，資料庫 Neon PostgreSQL
- 生產網址：`https://aon.tinyyana.com`

---

## 技術棧

- **Runtime**：Cloudflare Workers（Hono）
- **Frontend**：Vite + React 18 + TypeScript
- **Database**：Neon PostgreSQL + Drizzle ORM（所有表在 `aon` schema 下）
- **Auth**：Discord OAuth2 + HMAC-SHA256 stateless cookie
- **Styling**：Tailwind CSS v4（`src/app/styles/index.css` 定義 @theme）
- **Animation**：GSAP 3 + `@gsap/react`
- **Extension**：Browser MV3（`extension/` 目錄，支援巴哈動畫瘋 + anime1.me）

---

## 關鍵檔案

| 檔案 | 用途 |
|------|------|
| `src/app/components/ui.tsx` | 所有共用 UI 元件 |
| `src/app/lib/motion.ts` | EASE、DUR 常數、useReveal hook |
| `src/app/lib/watch.ts` | markEpisodeWatched()（看完一集核心） |
| `src/app/lib/auth.tsx` | useAuth、RequireApp、RequireAdmin |
| `src/app/styles/index.css` | 設計 token、全域樣式、彼岸花紋路 |
| `src/shared/types.ts` | 前後端共用型別 |
| `src/shared/validators.ts` | Zod validators |
| `src/worker/env.ts` | Cloudflare Bindings 型別 |

---

## UI 核心規範

- 美學：**輕百合・日常向**，暖紫玫瑰色系，不是終端機/SaaS 風格
- `.section-label`：區塊標籤（不大寫、不 mono、暖色）
- `.kbd-label`：技術 metadata 專用（集數、日期、外部 ID）
- **禁止** `//` 前綴標籤風格
- Panel = `rounded-xl`，Button = `rounded-lg`，Badge = `rounded-full`
- `.higanbana`：六瓣花紋背景裝飾，只裝飾用，無內容意義
- `.rail`：進度條（signal→accent 漸層），用 `<ProgressRail>` 元件

## 動畫規範

- 頁面入場：`useReveal(deps)` hook + `data-reveal` 屬性
- 所有 GSAP 動畫在 `useGSAP` hook 內執行（自動 cleanup）
- `EASE = "power3.out"`，reduced-motion 由 useReveal 自動處理

---

## 文案規範

- 空狀態 hint、短標籤 → 不加句號
- 完整說明句、錯誤訊息 → 加句號
- 按鈕文字、導航標籤 → 不加句號
- 語氣：輕鬆直接，繁體中文

---

## 重要業務邏輯

- **看完一集**：用 `markEpisodeWatched(animeId, episodeNumber)`，不要自己 patch currentEpisode
- **Source links 權限**：只有 admin/owner 可新增或刪除，member 只能看
- **Session**：stateless，每 request 重載使用者，ban/角色變更立即生效
- **角色**：`owner > admin > moderator > member > pending > banned`

---

## 建議 Skills

| 情況 | Skill |
|------|-------|
| Coding 任務有模糊需求或 bug 風險 | `careful-coding` |
| UI 複雜度、層級問題 | `ui-complexity` |
| 新頁面或大幅重設計 | `ui-art-direction` → `ui-refactoring` |
| 動畫相關 | `gsap-react`、`motion-design` |
| 繁體中文文案 | `tinyyana-speaking-style` |
| 安全審查 | `engineering-security-engineer` |

---

## 授權

TYUSL v1.0（TinyYana Universal Software License）。詳見 LICENSE 檔案。
商業授權：admin@tinyyana.com
