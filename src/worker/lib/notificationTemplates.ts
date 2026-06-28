import type { NotificationType } from "../../shared/types";

export type NotificationTemplateKey =
  | "application.approved"
  | "application.rejected"
  | "animeEdit.approved"
  | "animeEdit.rejected"
  | "anime.merged"
  | "note.removed";

type NotificationTemplateContext = {
  animeId?: string;
  animeTitle?: string;
  sourceTitle?: string;
  targetId?: string;
  targetTitle?: string;
  reviewReason?: string | null;
  noteReason?: string | null;
};

export type NotificationTemplate = {
  type: NotificationType;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
};

function withReason(base: string, reason?: string | null) {
  return reason?.trim() ? `${base}\n\n管理員補充：${reason.trim()}` : base;
}

const templates: Record<NotificationTemplateKey, (ctx: NotificationTemplateContext) => NotificationTemplate> = {
  "application.approved": ({ reviewReason }) => ({
    type: "application_approved",
    title: "追番進行式申請已通過",
    body: withReason(
      "歡迎加入追番進行式。你現在可以進入 App 建立追番清單、記錄看到哪一集，也可以協助測試動畫搜尋與譯名命中狀況。\n\n目前仍是早期版本，功能與資料可能會調整；遇到問題時請到測試頻道回報。",
      reviewReason,
    ),
    linkUrl: "/app",
  }),
  "application.rejected": ({ reviewReason }) => ({
    type: "application_rejected",
    title: "追番進行式申請未通過",
    body: withReason(
      "這次申請暫時沒有通過。可能是平台名額、申請資訊不足，或目前階段尚未適合開放給更多使用者。\n\n如果你認為這是誤判，或想補充申請資訊，可以再聯繫管理員。",
      reviewReason,
    ),
    linkUrl: "/apply",
  }),
  "animeEdit.approved": ({ animeId, animeTitle, reviewReason }) => ({
    type: "admin_notice",
    title: "動畫資料編輯已通過",
    body: withReason(
      `你提交的「${animeTitle ?? "動畫資料"}」編輯提案已經套用。感謝協助修正作品資訊，這會讓其他使用者更容易找到正確作品。`,
      reviewReason,
    ),
    linkUrl: animeId ? `/app/anime/${animeId}` : "/app",
  }),
  "animeEdit.rejected": ({ animeId, animeTitle, reviewReason }) => ({
    type: "admin_notice",
    title: "動畫資料編輯未通過",
    body: withReason(
      `你提交的「${animeTitle ?? "動畫資料"}」編輯提案這次沒有套用。可能是資料來源不足、與現有資料重複，或目前無法確認哪個名稱較適合作為主要資料。\n\n你仍然可以在作品頁查看目前資料，之後再提交更完整的修正。`,
      reviewReason,
    ),
    linkUrl: animeId ? `/app/anime/${animeId}` : "/app",
  }),
  "anime.merged": ({ sourceTitle, targetId, targetTitle }) => ({
    type: "anime_merged",
    title: "作品資料已合併",
    body: `「${sourceTitle ?? "來源作品"}」已合併到「${targetTitle ?? "目標作品"}」。這通常是因為同一部作品被不同名稱、不同語言或不同資料來源重複建立。\n\n你的追番紀錄、觀看進度與相關資料會盡量保留並轉移到合併後的作品。`,
    linkUrl: targetId ? `/app/anime/${targetId}` : "/app",
  }),
  "note.removed": ({ animeId, animeTitle, noteReason }) => ({
    type: "note_removed",
    title: "你的花瓣短評已被移除",
    body: withReason(
      `你在「${animeTitle ?? "某部作品"}」留下的花瓣短評已被管理員移除，因此不會再顯示於作品頁。\n\n這可能是因為內容包含過度劇透、與作品無關、重複發送，或不符合目前測試階段的社群規則。`,
      noteReason,
    ),
    linkUrl: animeId ? `/app/anime/${animeId}` : "/app",
  }),
};

export function notificationTemplate(key: NotificationTemplateKey, context: NotificationTemplateContext = {}) {
  return templates[key](context);
}

export function applicationReviewDmTemplate(
  key: "application.approved" | "application.rejected",
  appBaseUrl: string,
  context: Pick<NotificationTemplateContext, "reviewReason"> = {},
) {
  if (key === "application.approved") {
    return [
      "✅ 你的 AnimeOwatteiNai｜追番進行式申請已通過！",
      "",
      "你現在可以登入網站，開始建立追番清單、記錄看到第幾集、整理觀看入口，並協助測試動畫搜尋與台灣譯名命中狀況。",
      "",
      `入口：${appBaseUrl}/app`,
      "",
      "目前仍是早期版本，功能與資料可能會調整。如果遇到 bug、搜尋不到作品、匯入錯誤或 UI 不順，請到測試頻道回報。",
      context.reviewReason?.trim() ? `\n管理員補充：${context.reviewReason.trim()}` : "",
    ].filter(Boolean).join("\n");
  }

  return [
    "❌ 你的 AnimeOwatteiNai｜追番進行式申請暫時未通過。",
    "",
    "可能是目前測試名額有限、申請資訊不足，或這一階段尚未適合開放給更多使用者。",
    "",
    "如果你認為這是誤判，或想補充申請資訊，可以再聯繫管理員。",
    context.reviewReason?.trim() ? `\n管理員補充：${context.reviewReason.trim()}` : "",
  ].filter(Boolean).join("\n");
}
