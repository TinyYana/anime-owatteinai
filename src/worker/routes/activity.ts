import { Hono } from "hono";
import { and, desc, eq, lt } from "drizzle-orm";
import { activityEvents } from "../../db/schema";
import { requireAuth, requireAppAccess } from "../middleware/auth";
import type { AppEnv } from "../env";

export const activityRoutes = new Hono<AppEnv>();
activityRoutes.use("*", requireAuth, requireAppAccess);

activityRoutes.get("/", async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 30, 1), 100);
  const cursor = c.req.query("cursor");
  const cursorDate = cursor ? new Date(cursor) : null;
  const where =
    cursorDate && !Number.isNaN(cursorDate.getTime())
      ? and(
          eq(activityEvents.actorUserId, c.get("user").id),
          eq(activityEvents.visibility, "private"),
          lt(activityEvents.createdAt, cursorDate),
        )
      : and(eq(activityEvents.actorUserId, c.get("user").id), eq(activityEvents.visibility, "private"));

  const rows = await c.get("db")
    .select()
    .from(activityEvents)
    .where(where)
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);

  return c.json({
    items: rows,
    nextCursor: rows.length === limit ? rows[rows.length - 1]?.createdAt.toISOString() ?? null : null,
  });
});
