import { and, desc, eq, gte } from "drizzle-orm";
import type { DB } from "../../db/client";
import { anime, userAnime, users, watchSessions } from "../../db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const PRIORITY_LABEL: Record<string, string> = {
  high: "優先",
  normal: "普通",
  low: "慢慢看",
};

type PublicActivityRow = {
  episodeNumber: number;
  userName: string | null;
  animeTitle: string | null;
  animeTitleFallback: string;
};

function titleOf(row: { animeTitle: string | null; animeTitleFallback: string }) {
  return row.animeTitle ?? row.animeTitleFallback;
}

export async function getPublicRecentActivity(db: DB, limit: number): Promise<PublicActivityRow[]> {
  const since = new Date(Date.now() - DAY_MS);
  return db
    .select({
      episodeNumber: watchSessions.episodeNumber,
      userName: users.discordGlobalName,
      animeTitle: anime.titleZh,
      animeTitleFallback: anime.title,
    })
    .from(watchSessions)
    .innerJoin(users, eq(users.id, watchSessions.userId))
    .innerJoin(anime, eq(anime.id, watchSessions.animeId))
    .innerJoin(
      userAnime,
      and(
        eq(userAnime.userId, watchSessions.userId),
        eq(userAnime.animeId, watchSessions.animeId),
        eq(userAnime.isPublic, true),
      ),
    )
    .where(and(gte(watchSessions.watchedAt, since), eq(watchSessions.completed, true)))
    .orderBy(desc(watchSessions.watchedAt))
    .limit(limit);
}

export function buildCommunitySummary(rows: PublicActivityRow[], appBaseUrl?: string): string | null {
  if (rows.length === 0) return null;

  const uniqueTitles = new Set(rows.map(titleOf));
  const uniqueUsers = new Set(rows.map((row) => row.userName ?? "？"));
  const lines = rows.map((row) => `· **${titleOf(row)}** EP${row.episodeNumber} — ${row.userName ?? "？"}`);
  const footer = appBaseUrl ? `\n\n追番進行式：${appBaseUrl}/app` : "";

  return [
    "**追番進行式 · 昨日公開追番摘要**",
    `${uniqueUsers.size} 位成員、${uniqueTitles.size} 部作品有新的公開進度。`,
    ...lines,
    "只列出成員主動公開的追番紀錄。",
  ].join("\n") + footer;
}

export async function buildPersonalTodayBrief(db: DB, discordId: string, includeCommunity = true): Promise<string> {
  const user = await db.query.users.findFirst({ where: eq(users.discordId, discordId) });
  if (!user) return "你還沒有在追番進行式建立帳號。";

  const since = new Date(Date.now() - DAY_MS);
  const [nextRows, recentRows, publicRows] = await Promise.all([
    db
      .select({
        currentEpisode: userAnime.currentEpisode,
        priority: userAnime.priority,
        animeTitle: anime.titleZh,
        animeTitleFallback: anime.title,
        episodesTotal: anime.episodesTotal,
      })
      .from(userAnime)
      .innerJoin(anime, eq(anime.id, userAnime.animeId))
      .where(and(eq(userAnime.userId, user.id), eq(userAnime.status, "watching")))
      .orderBy(desc(userAnime.updatedAt))
      .limit(5),
    db
      .select({
        episodeNumber: watchSessions.episodeNumber,
        animeTitle: anime.titleZh,
        animeTitleFallback: anime.title,
      })
      .from(watchSessions)
      .innerJoin(anime, eq(anime.id, watchSessions.animeId))
      .where(and(eq(watchSessions.userId, user.id), gte(watchSessions.watchedAt, since), eq(watchSessions.completed, true)))
      .orderBy(desc(watchSessions.watchedAt))
      .limit(5),
    includeCommunity ? getPublicRecentActivity(db, 5) : Promise.resolve([]),
  ]);

  const sections = ["**你的今日追番簡報**"];

  if (nextRows.length > 0) {
    sections.push(
      "**接著看**",
      ...nextRows.map((row) => {
        const nextEpisode = row.currentEpisode + 1;
        const total = row.episodesTotal ? ` / ${row.episodesTotal}` : "";
        return `· **${titleOf(row)}** — 接著 EP${nextEpisode}${total}（${PRIORITY_LABEL[row.priority]}）`;
      }),
    );
  } else {
    sections.push("**接著看**", "· 目前沒有進行中的追番。");
  }

  if (recentRows.length > 0) {
    sections.push(
      "**最近 24 小時看完**",
      ...recentRows.map((row) => `· **${titleOf(row)}** EP${row.episodeNumber}`),
    );
  }

  if (publicRows.length > 0) {
    sections.push(
      "**社群公開動態**",
      ...publicRows.map((row) => `· **${titleOf(row)}** EP${row.episodeNumber} — ${row.userName ?? "？"}`),
    );
  }

  return sections.join("\n");
}
