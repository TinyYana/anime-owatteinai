import { Hono } from "hono";
import { count, eq } from "drizzle-orm";
import { accessApplications, animeEditRequests } from "../../db/schema";
import { requireAuth, roleHasPermission } from "../middleware/auth";
import type { AppEnv } from "../env";
import type { UserRole } from "../../shared/types";

export const adminTaskRoutes = new Hono<AppEnv>();
adminTaskRoutes.use("*", requireAuth);

function isMissingEditRequestTable(err: unknown) {
  return String(err).includes("anime_edit_requests");
}

adminTaskRoutes.get("/", async (c) => {
  const db = c.get("db");
  const role = c.get("user").role as UserRole;
  const [canReviewApplications, canReviewEdits] = await Promise.all([
    roleHasPermission(db, role, "applications.review"),
    roleHasPermission(db, role, "anime.manage"),
  ]);

  const [[applications], [edits]] = await Promise.all([
    canReviewApplications
      ? db.select({ total: count() }).from(accessApplications).where(eq(accessApplications.status, "pending"))
      : Promise.resolve([{ total: 0 }]),
    canReviewEdits
      ? db
        .select({ total: count() })
        .from(animeEditRequests)
        .where(eq(animeEditRequests.status, "pending"))
        .catch((err) => {
          if (isMissingEditRequestTable(err)) return [{ total: 0 }];
          throw err;
        })
      : Promise.resolve([{ total: 0 }]),
  ]);

  const pendingApplications = applications?.total ?? 0;
  const pendingEditRequests = edits?.total ?? 0;
  return c.json({
    pendingApplications,
    pendingEditRequests,
    total: pendingApplications + pendingEditRequests,
  });
});
