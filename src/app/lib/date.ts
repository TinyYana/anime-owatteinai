const TZ = "Asia/Taipei";

export const fmtDate = (v: string | Date) =>
  new Date(v).toLocaleDateString("zh-TW", { timeZone: TZ });

export const fmtDateTime = (v: string | Date) =>
  new Date(v).toLocaleString("zh-TW", { timeZone: TZ });
