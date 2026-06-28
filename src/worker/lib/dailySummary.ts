import { eq, desc, gte, and } from "drizzle-orm";
import { createDb } from "../../db/client";
import { watchSessions, users, anime } from "../../db/schema";
import { sendChannelMessage } from "./discord";
import type { Bindings } from "../env";

/**
 * Daily cron (0 9 * * *): post yesterday's community watch activity to the configured channel.
 * Skips silently if bot or channel not configured, or if there's nothing to report.
 */
export async function runDailySummary(env: Bindings): Promise<void> {
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_NOTIFICATION_CHANNEL_ID) return;

  const db = createDb(env.DATABASE_URL);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      episodeNumber: watchSessions.episodeNumber,
      userName: users.discordGlobalName,
      animeTitle: anime.titleZh,
      animeTitleFallback: anime.title,
    })
    .from(watchSessions)
    .innerJoin(users, eq(users.id, watchSessions.userId))
    .innerJoin(anime, eq(anime.id, watchSessions.animeId))
    .where(and(gte(watchSessions.watchedAt, since), eq(watchSessions.completed, true)))
    .orderBy(desc(watchSessions.watchedAt))
    .limit(20);

  if (rows.length === 0) return;

  const lines = rows.map((r) => `· **${r.animeTitle ?? r.animeTitleFallback}** EP${r.episodeNumber} — ${r.userName ?? "？"}`);
  const content = `📺 **追番進行式 · 昨日社群追番摘要**\n${lines.join("\n")}\n\n追番進行式：${env.APP_BASE_URL}/app`;
  await sendChannelMessage(env.DISCORD_BOT_TOKEN, env.DISCORD_NOTIFICATION_CHANNEL_ID, content);
}
