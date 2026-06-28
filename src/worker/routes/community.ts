import { Hono } from "hono";
import { and, count, eq, gt, inArray, isNull } from "drizzle-orm";
import { anime, animeNotes, userAnime, watchSessions } from "../../db/schema";
import { requireAuth, requireAppAccess } from "../middleware/auth";
import type { AppEnv } from "../env";
import type { CommunitySummaryItem } from "../../shared/types";

export const communityRoutes = new Hono<AppEnv>();
communityRoutes.use("*", requireAuth, requireAppAccess);

communityRoutes.get("/summary", async (c) => {
  const db = c.get("db");
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [watching, progress, notes] = await Promise.all([
    db
      .select({ animeId: userAnime.animeId, total: count() })
      .from(userAnime)
      .where(and(eq(userAnime.isPublic, true), eq(userAnime.status, "watching")))
      .groupBy(userAnime.animeId),
    db
      .select({ animeId: watchSessions.animeId, total: count() })
      .from(watchSessions)
      .innerJoin(userAnime, and(eq(userAnime.userId, watchSessions.userId), eq(userAnime.animeId, watchSessions.animeId)))
      .where(and(eq(userAnime.isPublic, true), gt(watchSessions.watchedAt, since)))
      .groupBy(watchSessions.animeId),
    db
      .select({ animeId: animeNotes.animeId, total: count() })
      .from(animeNotes)
      .where(and(eq(animeNotes.visibility, "community"), isNull(animeNotes.deletedAt)))
      .groupBy(animeNotes.animeId),
  ]);

  const ids = new Set<string>();
  for (const row of [...watching, ...progress, ...notes]) ids.add(row.animeId);
  if (ids.size === 0) return c.json({ trendingAnime: [] });

  const titles = await db
    .select({ id: anime.id, title: anime.title, titleZh: anime.titleZh })
    .from(anime)
    .where(inArray(anime.id, [...ids]));

  const watchingMap = new Map(watching.map((row) => [row.animeId, Number(row.total)]));
  const progressMap = new Map(progress.map((row) => [row.animeId, Number(row.total)]));
  const noteMap = new Map(notes.map((row) => [row.animeId, Number(row.total)]));

  const trendingAnime: CommunitySummaryItem[] = titles
    .map((row) => ({
      animeId: row.id,
      title: row.title,
      titleZh: row.titleZh,
      watchingCount: watchingMap.get(row.id) ?? 0,
      recentProgressCount: progressMap.get(row.id) ?? 0,
      noteCount: noteMap.get(row.id) ?? 0,
    }))
    .sort((a, b) =>
      (b.watchingCount + b.recentProgressCount + b.noteCount) -
      (a.watchingCount + a.recentProgressCount + a.noteCount),
    )
    .slice(0, 10);

  return c.json({ trendingAnime });
});
