import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { sourceLinks, anime } from "../../db/schema";
import { requireAuth, requireAppAccess, requirePermission } from "../middleware/auth";
import { parseBody } from "../util";
import { createSourceLinkSchema } from "../../shared/validators";
import { audit } from "../lib/audit";
import { recordActivityEvent } from "../lib/activity";
import type { AppEnv } from "../env";

// Mounted at /api — covers both /anime/:id/source-links and /source-links/:id.
// These rows store ONLY a label + URL. The app never fetches or proxies the
// content behind the URL.
// Source links are member-submitted labels + URLs. Deletion stays curated by
// roles with anime.manage.
export const sourceLinkRoutes = new Hono<AppEnv>();

sourceLinkRoutes.use("/anime/:id/source-links", requireAuth, requireAppAccess);
sourceLinkRoutes.use("/source-links/:id", requireAuth, requirePermission("anime.manage", "FORBIDDEN", "Anime management access required"));

sourceLinkRoutes.get("/anime/:id/source-links", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(sourceLinks)
    .where(eq(sourceLinks.animeId, c.req.param("id")))
    .orderBy(desc(sourceLinks.createdAt));
  return c.json(rows);
});

sourceLinkRoutes.post("/anime/:id/source-links", async (c) => {
  const animeId = c.req.param("id");
  const db = c.get("db");

  const exists = await db.query.anime.findFirst({ where: eq(anime.id, animeId) });
  if (!exists) {
    return c.json({ error: { code: "NOT_FOUND", message: "Anime not found" } }, 404);
  }

  const body = await parseBody(c, createSourceLinkSchema);
  if (body instanceof Response) return body;

  const [inserted] = await db
    .insert(sourceLinks)
    .values({
      animeId,
      userId: c.get("user").id,
      type: body.type,
      label: body.label,
      url: body.url,
    })
    .returning();

  void audit(db, "source_link.create", c.get("user").id, {
    targetType: "source_link",
    targetId: inserted?.id,
    metadata: { animeId, label: body.label, url: body.url },
  });
  void recordActivityEvent(db, {
    actorUserId: c.get("user").id,
    eventType: "source_link.created",
    targetType: "source_link",
    targetId: inserted?.id,
    visibility: "private",
    metadata: { animeId, label: body.label, type: body.type },
  });

  return c.json(inserted, 201);
});

// DELETE is admin-only (middleware already enforced above for this path).
sourceLinkRoutes.delete("/source-links/:id", async (c) => {
  const db = c.get("db");
  const link = await db.query.sourceLinks.findFirst({
    where: eq(sourceLinks.id, c.req.param("id")),
  });
  if (!link) return c.json({ error: { code: "NOT_FOUND", message: "Source link not found" } }, 404);

  await db.delete(sourceLinks).where(eq(sourceLinks.id, link.id));

  void audit(db, "source_link.delete", c.get("user").id, {
    targetType: "source_link",
    targetId: link.id,
    metadata: { animeId: link.animeId, label: link.label, url: link.url },
  });
  void recordActivityEvent(db, {
    actorUserId: c.get("user").id,
    eventType: "source_link.deleted",
    targetType: "source_link",
    targetId: link.id,
    visibility: "private",
    metadata: { animeId: link.animeId, label: link.label, type: link.type },
  });

  return c.json({ ok: true });
});
