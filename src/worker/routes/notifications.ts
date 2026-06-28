import { Hono } from "hono";
import { and, count, desc, eq } from "drizzle-orm";
import { notifications } from "../../db/schema";
import { requireAccount } from "../middleware/auth";
import { recordActivityEvent } from "../lib/activity";
import type { AppEnv } from "../env";

export const notificationRoutes = new Hono<AppEnv>();
notificationRoutes.use("*", requireAccount);

notificationRoutes.get("/", async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 50, 1), 100);
  const db = c.get("db");
  const userId = c.get("user").id;
  const [items, [unread]] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit),
    db
      .select({ total: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false))),
  ]);
  return c.json({ items, unreadCount: unread?.total ?? 0 });
});

notificationRoutes.post("/:id/read", async (c) => {
  const db = c.get("db");
  const userId = c.get("user").id;
  const [updated] = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.id, c.req.param("id")), eq(notifications.userId, userId)))
    .returning();
  if (!updated) return c.json({ error: { code: "NOT_FOUND", message: "Notification not found" } }, 404);

  void recordActivityEvent(db, {
    actorUserId: userId,
    eventType: "notification.read",
    targetType: "notification",
    targetId: updated.id,
    visibility: "private",
  });

  return c.json(updated);
});

notificationRoutes.post("/read-all", async (c) => {
  const db = c.get("db");
  const userId = c.get("user").id;
  await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  void recordActivityEvent(db, {
    actorUserId: userId,
    eventType: "notification.read",
    targetType: "notification",
    targetId: null,
    visibility: "private",
    metadata: { bulk: true },
  });
  return c.json({ ok: true });
});
