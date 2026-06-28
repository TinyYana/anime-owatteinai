import { Hono } from "hono";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { anime, animeNotes, users } from "../../db/schema";
import { requireAuth, requireAppAccess } from "../middleware/auth";
import { parseBody } from "../util";
import { createAnimeNoteSchema, deleteAnimeNoteSchema, updateAnimeNoteSchema } from "../../shared/validators";
import { recordActivityEvent } from "../lib/activity";
import { createNotificationFromTemplate } from "../lib/notifications";
import type { AppEnv } from "../env";
import type { NoteVisibility } from "../../shared/types";

export const animeNoteRoutes = new Hono<AppEnv>();
animeNoteRoutes.use("*", requireAuth, requireAppAccess);

animeNoteRoutes.get("/anime/:id/notes", async (c) => {
  const userId = c.get("user").id;
  const rows = await c.get("db")
    .select({
      id: animeNotes.id,
      animeId: animeNotes.animeId,
      userId: animeNotes.userId,
      episodeNumber: animeNotes.episodeNumber,
      type: animeNotes.type,
      spoilerLevel: animeNotes.spoilerLevel,
      visibility: animeNotes.visibility,
      content: animeNotes.content,
      createdAt: animeNotes.createdAt,
      updatedAt: animeNotes.updatedAt,
      deletedAt: animeNotes.deletedAt,
      deletedByUserId: animeNotes.deletedByUserId,
      deleteReason: animeNotes.deleteReason,
      userName: users.discordGlobalName,
    })
    .from(animeNotes)
    .innerJoin(users, eq(users.id, animeNotes.userId))
    .where(
      and(
        eq(animeNotes.animeId, c.req.param("id")),
        isNull(animeNotes.deletedAt),
        or(
          eq(animeNotes.userId, userId),
          eq(animeNotes.visibility, "community"),
        ),
      ),
    )
    .orderBy(desc(animeNotes.createdAt))
    .limit(100);

  return c.json({
    mine: rows.filter((row) => row.userId === userId),
    community: rows.filter((row) => row.visibility === "community" && row.userId !== userId),
  });
});

animeNoteRoutes.post("/anime/:id/notes", async (c) => {
  const body = await parseBody(c, createAnimeNoteSchema);
  if (body instanceof Response) return body;
  const db = c.get("db");
  const animeId = c.req.param("id");
  const exists = await db.query.anime.findFirst({ where: eq(anime.id, animeId) });
  if (!exists) return c.json({ error: { code: "NOT_FOUND", message: "Anime not found" } }, 404);

  const [inserted] = await db
    .insert(animeNotes)
    .values({
      animeId,
      userId: c.get("user").id,
      episodeNumber: body.episodeNumber ?? null,
      type: body.type,
      spoilerLevel: body.spoilerLevel,
      visibility: body.visibility,
      content: body.content,
    })
    .returning();

  void recordActivityEvent(db, {
    actorUserId: c.get("user").id,
    eventType: "note.created",
    targetType: "anime_note",
    targetId: inserted?.id,
    visibility: body.visibility as NoteVisibility,
    metadata: { animeId, episodeNumber: body.episodeNumber ?? null, type: body.type, spoilerLevel: body.spoilerLevel },
  });

  return c.json(inserted, 201);
});

animeNoteRoutes.patch("/anime-notes/:id", async (c) => {
  const body = await parseBody(c, updateAnimeNoteSchema);
  if (body instanceof Response) return body;
  const db = c.get("db");
  const note = await db.query.animeNotes.findFirst({ where: eq(animeNotes.id, c.req.param("id")) });
  if (!note || note.deletedAt) return c.json({ error: { code: "NOT_FOUND", message: "Note not found" } }, 404);
  if (note.userId !== c.get("user").id) {
    return c.json({ error: { code: "FORBIDDEN", message: "You can only edit your own notes" } }, 403);
  }

  const [updated] = await db
    .update(animeNotes)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(animeNotes.id, note.id))
    .returning();
  return c.json(updated);
});

animeNoteRoutes.delete("/anime-notes/:id", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const body = c.req.header("Content-Type")?.includes("application/json")
    ? await parseBody(c, deleteAnimeNoteSchema)
    : { deleteReason: null };
  if (body instanceof Response) return body;
  const note = await db.query.animeNotes.findFirst({ where: eq(animeNotes.id, c.req.param("id")) });
  if (!note || note.deletedAt) return c.json({ error: { code: "NOT_FOUND", message: "Note not found" } }, 404);

  const isOwner = note.userId === user.id;
  const isAdmin = user.role === "owner" || user.role === "admin";
  if (!isOwner && !isAdmin) {
    return c.json({ error: { code: "FORBIDDEN", message: "You can only delete your own notes" } }, 403);
  }

  const [updated] = await db
    .update(animeNotes)
    .set({
      deletedAt: new Date(),
      deletedByUserId: user.id,
      deleteReason: isOwner ? null : body.deleteReason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(animeNotes.id, note.id))
    .returning();

  if (!isOwner) {
    const noteAnime = await db.query.anime.findFirst({ where: eq(anime.id, note.animeId) });
    await createNotificationFromTemplate(db, note.userId, "note.removed", {
      animeId: note.animeId,
      animeTitle: noteAnime?.titleZh ?? noteAnime?.title,
      noteReason: body.deleteReason,
    });
  }

  void recordActivityEvent(db, {
    actorUserId: user.id,
    eventType: "note.deleted",
    targetType: "anime_note",
    targetId: note.id,
    visibility: "system",
    metadata: { animeId: note.animeId, ownerDeleted: isOwner },
  });

  return c.json(updated);
});
