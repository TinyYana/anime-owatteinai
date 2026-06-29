import { Hono } from "hono";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { userAnime, anime, watchSessions, sourceLinks } from "../../db/schema";
import { requireAuth, requireAppAccess } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { parseBody } from "../util";
import {
  addMyAnimeSchema,
  updateMyAnimeSchema,
  reorderMyAnimeSchema,
  createWatchSessionSchema,
} from "../../shared/validators";
import { recordActivityEvent } from "../lib/activity";
import type { AppEnv } from "../env";

// Select shape that nests the full joined anime row under `anime`.
const userAnimeWithAnime = {
  id: userAnime.id,
  userId: userAnime.userId,
  animeId: userAnime.animeId,
  status: userAnime.status,
  currentEpisode: userAnime.currentEpisode,
  priority: userAnime.priority,
  isPublic: userAnime.isPublic,
  privateNote: userAnime.privateNote,
  sortOrder: userAnime.sortOrder,
  createdAt: userAnime.createdAt,
  updatedAt: userAnime.updatedAt,
  anime: anime,
};

async function officialSourceLinkId(
  db: AppEnv["Variables"]["db"],
  userId: string,
  animeId: string,
  url?: string | null,
) {
  if (!url) return null;
  const parsed = new URL(url);
  if (parsed.hostname !== "ani.gamer.com.tw") return null;
  const linkLabel = "巴哈姆特動畫瘋";

  const existing = await db.query.sourceLinks.findFirst({
    where: and(eq(sourceLinks.animeId, animeId), eq(sourceLinks.label, linkLabel)),
  });
  if (existing) {
    if (existing.url !== parsed.toString()) {
      await db
        .update(sourceLinks)
        .set({ url: parsed.toString(), updatedAt: new Date() })
        .where(eq(sourceLinks.id, existing.id));
    }
    return existing.id;
  }

  const [inserted] = await db
    .insert(sourceLinks)
    .values({
      animeId,
      userId,
      type: "official",
      label: linkLabel,
      url: parsed.toString(),
    })
    .returning({ id: sourceLinks.id });
  return inserted?.id ?? null;
}

// --- /api/my/anime ---
export const myAnimeRoutes = new Hono<AppEnv>();
myAnimeRoutes.use("*", requireAuth, requireAppAccess);

myAnimeRoutes.get("/", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select(userAnimeWithAnime)
    .from(userAnime)
    .innerJoin(anime, eq(userAnime.animeId, anime.id))
    .where(eq(userAnime.userId, c.get("user").id))
    .orderBy(sql`${userAnime.sortOrder} asc nulls last`, desc(userAnime.updatedAt));
  return c.json(rows);
});

myAnimeRoutes.post("/", async (c) => {
  const body = await parseBody(c, addMyAnimeSchema);
  if (body instanceof Response) return body;
  const db = c.get("db");
  const userId = c.get("user").id;

  // Idempotent add: if the user already tracks this anime, return it.
  const existing = await db.query.userAnime.findFirst({
    where: and(eq(userAnime.userId, userId), eq(userAnime.animeId, body.animeId)),
  });
  if (existing) return c.json(existing);

  const inserted = await db
    .insert(userAnime)
    .values({
      userId,
      animeId: body.animeId,
      status: body.status,
      currentEpisode: body.currentEpisode,
      priority: body.priority,
      isPublic: body.isPublic,
      privateNote: body.privateNote ?? null,
    })
    .returning();
  void recordActivityEvent(db, {
    actorUserId: userId,
    eventType: "anime.added_to_list",
    targetType: "anime",
    targetId: body.animeId,
    visibility: "private",
    metadata: { status: body.status, priority: body.priority },
  });
  return c.json(inserted[0], 201);
});

myAnimeRoutes.patch("/reorder", async (c) => {
  const body = await parseBody(c, reorderMyAnimeSchema);
  if (body instanceof Response) return body;
  const db = c.get("db");
  const userId = c.get("user").id;
  const ids = body.orders.map((o) => o.id);
  // Ownership check: verify all ids belong to the current user
  const owned = await db
    .select({ id: userAnime.id })
    .from(userAnime)
    .where(and(inArray(userAnime.id, ids), eq(userAnime.userId, userId)));
  if (owned.length !== ids.length) {
    return c.json({ error: { code: "FORBIDDEN", message: "One or more entries not found" } }, 403);
  }
  await db.transaction(async (tx) => {
    for (const { id, sortOrder } of body.orders) {
      await tx.update(userAnime).set({ sortOrder }).where(eq(userAnime.id, id));
    }
  });
  return c.json({ ok: true });
});

myAnimeRoutes.patch("/:id", async (c) => {
  const body = await parseBody(c, updateMyAnimeSchema);
  if (body instanceof Response) return body;
  const db = c.get("db");
  // Ownership enforced by AND condition on userId
  const updated = await db
    .update(userAnime)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(userAnime.id, c.req.param("id")), eq(userAnime.userId, c.get("user").id)))
    .returning();
  if (updated.length === 0) {
    return c.json({ error: { code: "NOT_FOUND", message: "Entry not found" } }, 404);
  }
  if (body.status) {
    void recordActivityEvent(db, {
      actorUserId: c.get("user").id,
      eventType: "anime.status_changed",
      targetType: "anime",
      targetId: updated[0]?.animeId,
      visibility: "private",
      metadata: { status: body.status },
    });
  }
  if (body.currentEpisode !== undefined) {
    void recordActivityEvent(db, {
      actorUserId: c.get("user").id,
      eventType: "anime.progress_updated",
      targetType: "anime",
      targetId: updated[0]?.animeId,
      visibility: "private",
      metadata: { currentEpisode: body.currentEpisode },
    });
  }
  return c.json(updated[0]);
});

myAnimeRoutes.delete("/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("user").id;
  // Ownership enforced by AND condition on userId
  const deleted = await db
    .delete(userAnime)
    .where(and(eq(userAnime.id, c.req.param("id")), eq(userAnime.userId, userId)))
    .returning({ id: userAnime.id, animeId: userAnime.animeId });
  const row = deleted[0];
  if (!row) return c.json({ error: { code: "NOT_FOUND", message: "Entry not found" } }, 404);
  await db
    .delete(watchSessions)
    .where(and(eq(watchSessions.userId, userId), eq(watchSessions.animeId, row.animeId)));
  return c.json({ ok: true });
});

// --- /api/my/watch-sessions ---
export const watchSessionRoutes = new Hono<AppEnv>();
watchSessionRoutes.use("*", requireAuth, requireAppAccess);

watchSessionRoutes.get("/", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select({
      id: watchSessions.id,
      userId: watchSessions.userId,
      animeId: watchSessions.animeId,
      episodeNumber: watchSessions.episodeNumber,
      sourceLinkId: watchSessions.sourceLinkId,
      watchedAt: watchSessions.watchedAt,
      progress: watchSessions.progress,
      completed: watchSessions.completed,
      note: watchSessions.note,
      createdAt: watchSessions.createdAt,
      animeTitle: anime.title,
      animeTitleZh: anime.titleZh,
    })
    .from(watchSessions)
    .leftJoin(anime, eq(anime.id, watchSessions.animeId))
    .where(eq(watchSessions.userId, c.get("user").id))
    .orderBy(desc(watchSessions.watchedAt))
    .limit(100);
  return c.json(rows);
});

watchSessionRoutes.post("/", rateLimit("watchsession:create"), async (c) => {
  const body = await parseBody(c, createWatchSessionSchema);
  if (body instanceof Response) return body;
  const db = c.get("db");
  const userId = c.get("user").id;
  const sourceLinkId =
    body.sourceLinkId ?? (await officialSourceLinkId(db, userId, body.animeId, body.sourceUrl));

  const inserted = await db
    .insert(watchSessions)
    .values({
      userId,
      animeId: body.animeId,
      episodeNumber: body.episodeNumber,
      sourceLinkId,
      progress: body.progress ?? null,
      completed: body.completed,
      note: body.note ?? null,
    })
    .returning();
  void recordActivityEvent(db, {
    actorUserId: userId,
    eventType: "watch_session.created",
    targetType: "watch_session",
    targetId: inserted[0]?.id,
    visibility: "private",
    metadata: { animeId: body.animeId, episodeNumber: body.episodeNumber, completed: body.completed },
  });

  // On completion, mark it as actively watched and advance progress.
  if (body.completed) {
    void recordActivityEvent(db, {
      actorUserId: userId,
      eventType: "anime.episode_completed",
      targetType: "anime",
      targetId: body.animeId,
      visibility: "private",
      metadata: { episodeNumber: body.episodeNumber },
    });
    const tracking = await db.query.userAnime.findFirst({
      where: and(eq(userAnime.userId, userId), eq(userAnime.animeId, body.animeId)),
    });
    if (tracking) {
      await db
        .update(userAnime)
        .set({
          status: "watching",
          currentEpisode: Math.max(tracking.currentEpisode, body.episodeNumber),
          priority: body.priority ?? tracking.priority,
          updatedAt: new Date(),
        })
        .where(eq(userAnime.id, tracking.id));
    } else {
      await db
        .insert(userAnime)
        .values({
          userId,
          animeId: body.animeId,
          status: "watching",
          currentEpisode: body.episodeNumber,
          priority: body.priority ?? "normal",
        })
        .onConflictDoNothing();
    }
  }

  return c.json(inserted[0], 201);
});
