import { Hono } from "hono";
import { and, eq, ilike, or, desc, sql } from "drizzle-orm";
import { anime, userAnime, animeEditRequests } from "../../db/schema";
import { requireAuth, requireAppAccess, requirePermission } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { parseBody } from "../util";
import {
  createAnimeSchema,
  updateAnimeSchema,
  importAnimeSchema,
  createAnimeEditRequestSchema,
} from "../../shared/validators";
import { searchExternal } from "../lib/metadata";
import { audit } from "../lib/audit";
import type { AppEnv } from "../env";

export const animeRoutes = new Hono<AppEnv>();
animeRoutes.use("*", requireAuth, requireAppAccess);

function mergeSynonyms(
  ...groups: Array<Array<string | null | undefined> | string | null | undefined>
): string[] | null {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const group of groups) {
    const values = Array.isArray(group) ? group : [group];
    for (const value of values) {
      const text = value?.trim();
      const key = text?.toLocaleLowerCase();
      if (!text || !key || seen.has(key)) continue;
      seen.add(key);
      merged.push(text);
      if (merged.length >= 50) return merged;
    }
  }
  return merged.length > 0 ? merged : null;
}

// List anime (optionally filtered by ?q= across all title variants).
animeRoutes.get("/", async (c) => {
  const q = c.req.query("q")?.trim();
  const db = c.get("db");
  const rows = q
    ? await db
        .select()
        .from(anime)
        .where(
          or(
            ilike(anime.title, `%${q}%`),
            ilike(anime.titleZh, `%${q}%`),
            ilike(anime.titleJp, `%${q}%`),
            ilike(anime.titleRomaji, `%${q}%`),
            ilike(anime.titleEnglish, `%${q}%`),
            ilike(anime.titleNative, `%${q}%`),
            sql`${anime.synonyms}::text ilike ${"%" + q + "%"}`,
          ),
        )
        .orderBy(desc(anime.createdAt))
        .limit(100)
    : await db.select().from(anime).orderBy(desc(anime.createdAt)).limit(100);
  return c.json(rows);
});

// Local + external search. Rate limited per user.
animeRoutes.get("/search", rateLimit("anime:search"), async (c) => {
  const q = c.req.query("q")?.trim();
  if (!q) return c.json({ local: [], external: [] });

  const db = c.get("db");
  const [local, external] = await Promise.all([
    db
      .select()
      .from(anime)
      .where(
        or(
          ilike(anime.title, `%${q}%`),
          ilike(anime.titleZh, `%${q}%`),
          ilike(anime.titleJp, `%${q}%`),
          ilike(anime.titleRomaji, `%${q}%`),
          ilike(anime.titleEnglish, `%${q}%`),
          ilike(anime.titleNative, `%${q}%`),
          sql`${anime.synonyms}::text ilike ${"%" + q + "%"}`,
        ),
      )
      .orderBy(desc(anime.createdAt))
      .limit(20),
    searchExternal(q, c.env.METADATA_CACHE),
  ]);

  return c.json({ local, external });
});

// Import a selected external candidate. Deduplicates by external IDs.
// Rate limited per user to avoid external API spam.
animeRoutes.post("/import", rateLimit("anime:import"), async (c) => {
  const body = await parseBody(c, importAnimeSchema);
  if (body instanceof Response) return body;

  const db = c.get("db");

  let existing =
    body.externalAnilistId
      ? await db.query.anime.findFirst({
          where: eq(anime.externalAnilistId, body.externalAnilistId),
        })
      : null;
  existing =
    existing ??
    (body.externalMalId
      ? await db.query.anime.findFirst({
          where: eq(anime.externalMalId, body.externalMalId),
        })
      : null);
  existing =
    existing ??
    (body.externalBangumiId
      ? await db.query.anime.findFirst({
          where: eq(anime.externalBangumiId, body.externalBangumiId),
        })
      : null);

  if (existing) {
    const synonyms = mergeSynonyms(existing.synonyms, body.synonyms, body.observedTitle);
    const animeRow =
      synonyms && JSON.stringify(synonyms) !== JSON.stringify(existing.synonyms)
        ? (
            await db
              .update(anime)
              .set({ synonyms, updatedAt: new Date() })
              .where(eq(anime.id, existing.id))
              .returning()
          )[0] ?? existing
        : existing;

    if (body.addToList) {
      const alreadyTracked = await db.query.userAnime.findFirst({
        where: and(eq(userAnime.userId, c.get("user").id), eq(userAnime.animeId, existing.id)),
      });
      if (!alreadyTracked) {
        await db
          .insert(userAnime)
          .values({ userId: c.get("user").id, animeId: existing.id, status: "planned" })
          .onConflictDoNothing();
      }
    }
    return c.json({ anime: animeRow }, 200);
  }

  const rows = await db
    .insert(anime)
    .values({
      title: body.title,
      titleZh: body.titleZh ?? null,
      titleJp: body.titleJp ?? null,
      titleRomaji: body.titleRomaji ?? null,
      titleEnglish: body.titleEnglish ?? null,
      titleNative: body.titleNative ?? null,
      synonyms: mergeSynonyms(body.synonyms, body.observedTitle),
      externalAnilistId: body.externalAnilistId ?? null,
      externalMalId: body.externalMalId ?? null,
      externalBangumiId: body.externalBangumiId ?? null,
      format: body.format ?? null,
      statusExternal: body.statusExternal ?? null,
      season: body.season ?? null,
      seasonYear: body.seasonYear ?? null,
      episodesTotal: body.episodesTotal ?? null,
      coverImageUrl: body.coverImageUrl ?? null,
      description: body.description ?? null,
      metadataSource: (body.metadataSource as "manual" | "anilist" | "bangumi" | "jikan") ?? "anilist",
      metadataFetchedAt: new Date(),
      createdByUserId: c.get("user").id,
    })
    .returning();
  const inserted = rows[0];
  if (!inserted) {
    return c.json({ error: { code: "INSERT_FAILED", message: "Failed to create anime" } }, 500);
  }

  if (body.addToList) {
    await db
      .insert(userAnime)
      .values({ userId: c.get("user").id, animeId: inserted.id, status: "planned" })
      .onConflictDoNothing();
  }

  void audit(db, "anime.import", c.get("user").id, {
    targetType: "anime",
    targetId: inserted.id,
    metadata: { title: inserted.title, source: inserted.metadataSource },
  });

  return c.json({ anime: inserted }, 201);
});

// Manual creation (minimal fields, no external lookup).
animeRoutes.post("/", async (c) => {
  const body = await parseBody(c, createAnimeSchema);
  if (body instanceof Response) return body;
  const db = c.get("db");
  const [inserted] = await db
    .insert(anime)
    .values({
      title: body.title,
      titleZh: body.titleZh ?? null,
      titleJp: body.titleJp ?? null,
      description: body.description ?? null,
      metadataSource: "manual",
      createdByUserId: c.get("user").id,
    })
    .returning();
  return c.json(inserted, 201);
});

animeRoutes.post("/:id/edit-requests", async (c) => {
  const body = await parseBody(c, createAnimeEditRequestSchema);
  if (body instanceof Response) return body;
  const db = c.get("db");
  const animeId = c.req.param("id");
  const exists = await db.query.anime.findFirst({ where: eq(anime.id, animeId) });
  if (!exists) return c.json({ error: { code: "NOT_FOUND", message: "Anime not found" } }, 404);

  const [inserted] = await db
    .insert(animeEditRequests)
    .values({
      animeId,
      userId: c.get("user").id,
      payload: body.payload,
      note: body.note ?? null,
    })
    .returning();
  return c.json(inserted, 201);
});

animeRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const row = await db.query.anime.findFirst({ where: eq(anime.id, c.req.param("id")) });
  if (!row) return c.json({ error: { code: "NOT_FOUND", message: "Anime not found" } }, 404);
  return c.json(row);
});

animeRoutes.patch("/:id", requirePermission("anime.manage", "FORBIDDEN", "Anime management access required"), async (c) => {
  const body = await parseBody(c, updateAnimeSchema);
  if (body instanceof Response) return body;
  if (Object.keys(body).length === 0) {
    return c.json({ error: { code: "NO_FIELDS", message: "No fields to update" } }, 400);
  }

  const db = c.get("db");
  const [updated] = await db
    .update(anime)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(anime.id, c.req.param("id")))
    .returning();
  if (!updated) return c.json({ error: { code: "NOT_FOUND", message: "Anime not found" } }, 404);

  void audit(db, "anime.update", c.get("user").id, {
    targetType: "anime",
    targetId: updated.id,
    metadata: { fields: Object.keys(body) },
  });

  return c.json(updated);
});
