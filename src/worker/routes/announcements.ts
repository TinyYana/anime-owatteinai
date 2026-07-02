import { Hono } from "hono";
import type { Context } from "hono";
import { desc, eq, or, isNull, lte } from "drizzle-orm";
import { siteAnnouncements, users } from "../../db/schema";
import { readSession } from "../auth/session";
import { requireAuth } from "../middleware/auth";
import { parseBody } from "../util";
import { createAnnouncementSchema, updateAnnouncementSchema } from "../../shared/validators";
import { recordActivityEvent } from "../lib/activity";
import { createNotification } from "../lib/notifications";
import type { AppEnv } from "../env";
import type { AnnouncementAudience, UserRole } from "../../shared/types";

export const announcementRoutes = new Hono<AppEnv>();

function audiencesForRole(role: UserRole | null): AnnouncementAudience[] {
  if (role === "owner" || role === "admin") return ["all", "member", "admin"];
  if (role === "moderator" || role === "member") return ["all", "member"];
  return ["all"];
}

async function currentRole(c: Context<AppEnv>): Promise<UserRole | null> {
  const session = await readSession(c.env.SESSION_SECRET, c.req.header("Cookie") ?? null);
  if (!session) return null;
  const user = await c.get("db").query.users.findFirst({ where: eq(users.id, session.userId) });
  return (user?.role as UserRole | undefined) ?? null;
}

function requireAdminOwner(role: string) {
  return role === "owner" || role === "admin";
}

function announcementTargets(role: UserRole, audience: AnnouncementAudience) {
  if (role === "banned") return false;
  if (audience === "admin") return role === "owner" || role === "admin";
  if (audience === "member") return role === "owner" || role === "admin" || role === "moderator" || role === "member";
  return true;
}

announcementRoutes.get("/announcements/active", async (c) => {
  const now = new Date();
  const allowed = new Set(audiencesForRole(await currentRole(c)));
  const rows = await c.get("db")
    .select()
    .from(siteAnnouncements)
    .where(
      or(
        isNull(siteAnnouncements.startsAt),
        lte(siteAnnouncements.startsAt, now),
      ),
    )
    .orderBy(desc(siteAnnouncements.createdAt))
    .limit(50);

  return c.json(rows.filter((row) =>
    row.isActive &&
    allowed.has(row.audience as AnnouncementAudience) &&
    (!row.endsAt || row.endsAt >= now),
  ));
});

announcementRoutes.use("/admin/announcements", requireAuth);
announcementRoutes.use("/admin/announcements/*", requireAuth);

announcementRoutes.get("/admin/announcements", async (c) => {
  if (!requireAdminOwner(c.get("user").role)) {
    return c.json({ error: { code: "FORBIDDEN", message: "Admin access required" } }, 403);
  }
  const rows = await c.get("db")
    .select()
    .from(siteAnnouncements)
    .orderBy(desc(siteAnnouncements.createdAt))
    .limit(100);
  return c.json(rows);
});

announcementRoutes.post("/admin/announcements", async (c) => {
  if (!requireAdminOwner(c.get("user").role)) {
    return c.json({ error: { code: "FORBIDDEN", message: "Admin access required" } }, 403);
  }
  const body = await parseBody(c, createAnnouncementSchema);
  if (body instanceof Response) return body;
  const db = c.get("db");
  const [inserted] = await db
    .insert(siteAnnouncements)
    .values({
      ...body,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      createdByUserId: c.get("user").id,
    })
    .returning();

  void recordActivityEvent(db, {
    actorUserId: c.get("user").id,
    eventType: "announcement.created",
    targetType: "announcement",
    targetId: inserted?.id,
    visibility: "system",
    metadata: { title: inserted?.title, level: inserted?.level, audience: inserted?.audience },
  });
  if (
    inserted?.isActive &&
    (!inserted.startsAt || inserted.startsAt <= new Date()) &&
    (!inserted.endsAt || inserted.endsAt >= new Date())
  ) {
    const targetUsers = await db.select({ id: users.id, role: users.role }).from(users);
    await Promise.all(targetUsers
      .filter((user) => announcementTargets(user.role as UserRole, inserted.audience as AnnouncementAudience))
      .map((user) => createNotification(db, {
        userId: user.id,
        type: "announcement",
        title: inserted.title,
        body: inserted.content,
        linkUrl: null,
      })));
  }

  return c.json(inserted, 201);
});

announcementRoutes.patch("/admin/announcements/:id", async (c) => {
  if (!requireAdminOwner(c.get("user").role)) {
    return c.json({ error: { code: "FORBIDDEN", message: "Admin access required" } }, 403);
  }
  const body = await parseBody(c, updateAnnouncementSchema);
  if (body instanceof Response) return body;
  const db = c.get("db");
  const changes: Partial<typeof siteAnnouncements.$inferInsert> = { updatedAt: new Date() };
  if (body.title !== undefined) changes.title = body.title;
  if (body.content !== undefined) changes.content = body.content;
  if (body.level !== undefined) changes.level = body.level;
  if (body.audience !== undefined) changes.audience = body.audience;
  if (body.isActive !== undefined) changes.isActive = body.isActive;
  if (body.startsAt !== undefined) changes.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (body.endsAt !== undefined) changes.endsAt = body.endsAt ? new Date(body.endsAt) : null;
  const [updated] = await db
    .update(siteAnnouncements)
    .set(changes)
    .where(eq(siteAnnouncements.id, c.req.param("id")))
    .returning();
  if (!updated) return c.json({ error: { code: "NOT_FOUND", message: "Announcement not found" } }, 404);

  void recordActivityEvent(db, {
    actorUserId: c.get("user").id,
    eventType: "announcement.updated",
    targetType: "announcement",
    targetId: updated.id,
    visibility: "system",
    metadata: { fields: Object.keys(body) },
  });

  return c.json(updated);
});

announcementRoutes.delete("/admin/announcements/:id", async (c) => {
  if (!requireAdminOwner(c.get("user").role)) {
    return c.json({ error: { code: "FORBIDDEN", message: "Admin access required" } }, 403);
  }
  const db = c.get("db");
  const [updated] = await db
    .update(siteAnnouncements)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(siteAnnouncements.id, c.req.param("id")))
    .returning();
  if (!updated) return c.json({ error: { code: "NOT_FOUND", message: "Announcement not found" } }, 404);

  void recordActivityEvent(db, {
    actorUserId: c.get("user").id,
    eventType: "announcement.deleted",
    targetType: "announcement",
    targetId: updated.id,
    visibility: "system",
    metadata: { title: updated.title },
  });

  return c.json({ ok: true });
});
