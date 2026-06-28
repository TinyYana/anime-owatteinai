import { Hono } from "hono";
import type { Context } from "hono";
import { eq, and, desc, inArray, ne } from "drizzle-orm";
import { accessApplications, users } from "../../db/schema";
import { requireAuth, requirePermission } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { parseBody } from "../util";
import { createApplicationSchema, reviewApplicationSchema } from "../../shared/validators";
import { audit } from "../lib/audit";
import { recordActivityEvent } from "../lib/activity";
import { createNotificationFromTemplate } from "../lib/notifications";
import { applicationReviewDmTemplate } from "../lib/notificationTemplates";
import { sendDM } from "../lib/discord";
import type { AppEnv } from "../env";

// --- Applicant-facing (any authenticated, non-banned user incl. pending) ---
export const applicationRoutes = new Hono<AppEnv>();
applicationRoutes.use("*", requireAuth);

// Current user's latest application (or null).
applicationRoutes.get("/me", async (c) => {
  const db = c.get("db");
  const app = await db.query.accessApplications.findFirst({
    where: eq(accessApplications.userId, c.get("user").id),
    orderBy: [desc(accessApplications.createdAt)],
  });
  return c.json(app ?? null);
});

// Submit an application. Only pending users need to; reject re-submission spam
// by reusing an existing pending row.
applicationRoutes.post(
  "/",
  rateLimit("application:submit"),
  async (c) => {
    const user = c.get("user");
    if (user.role !== "pending") {
      return c.json({ error: { code: "ALREADY_MEMBER", message: "Already a member" } }, 400);
    }
    const body = await parseBody(c, createApplicationSchema);
    if (body instanceof Response) return body;

    const db = c.get("db");
    const existingPending = await db.query.accessApplications.findFirst({
      where: and(
        eq(accessApplications.userId, user.id),
        eq(accessApplications.status, "pending"),
      ),
    });

    let result;
    if (existingPending) {
      const updated = await db
        .update(accessApplications)
        .set({ message: body.message ?? null, updatedAt: new Date() })
        .where(eq(accessApplications.id, existingPending.id))
        .returning();
      result = updated[0];
    } else {
      const inserted = await db
        .insert(accessApplications)
        .values({ userId: user.id, message: body.message ?? null, status: "pending" })
        .returning();
      result = inserted[0];
    }

    void audit(db, "application.submit", user.id, {
      targetType: "application",
      targetId: result?.id,
    });
    void recordActivityEvent(db, {
      actorUserId: user.id,
      eventType: "application.submit",
      targetType: "application",
      targetId: result?.id,
      visibility: "system",
    });

    return c.json(result, existingPending ? 200 : 201);
  },
);

// --- Admin review ---
export const adminApplicationRoutes = new Hono<AppEnv>();
adminApplicationRoutes.use("*", requireAuth, requirePermission("applications.review", "FORBIDDEN", "Application review access required"));

// List pending applications joined with the applicant.
adminApplicationRoutes.get("/", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select({
      id: accessApplications.id,
      userId: accessApplications.userId,
      status: accessApplications.status,
      message: accessApplications.message,
      reviewedByUserId: accessApplications.reviewedByUserId,
      reviewedAt: accessApplications.reviewedAt,
      reviewReason: accessApplications.reviewReason,
      createdAt: accessApplications.createdAt,
      updatedAt: accessApplications.updatedAt,
      user: {
        id: users.id,
        discordId: users.discordId,
        discordUsername: users.discordUsername,
        discordGlobalName: users.discordGlobalName,
        discordAvatar: users.discordAvatar,
        role: users.role,
      },
    })
    .from(accessApplications)
    .innerJoin(users, eq(accessApplications.userId, users.id))
    .where(eq(accessApplications.status, "pending"))
    .orderBy(desc(accessApplications.createdAt));
  return c.json(rows);
});

adminApplicationRoutes.get("/reviewed", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select({
      id: accessApplications.id,
      userId: accessApplications.userId,
      status: accessApplications.status,
      message: accessApplications.message,
      reviewedByUserId: accessApplications.reviewedByUserId,
      reviewedAt: accessApplications.reviewedAt,
      reviewReason: accessApplications.reviewReason,
      createdAt: accessApplications.createdAt,
      updatedAt: accessApplications.updatedAt,
      user: {
        id: users.id,
        discordId: users.discordId,
        discordUsername: users.discordUsername,
        discordGlobalName: users.discordGlobalName,
        discordAvatar: users.discordAvatar,
        role: users.role,
      },
    })
    .from(accessApplications)
    .innerJoin(users, eq(accessApplications.userId, users.id))
    .where(ne(accessApplications.status, "pending"))
    .orderBy(desc(accessApplications.reviewedAt), desc(accessApplications.createdAt))
    .limit(50);

  const reviewerIds = Array.from(new Set(rows.map((row) => row.reviewedByUserId).filter((id): id is string => !!id)));
  const reviewers = reviewerIds.length === 0 ? [] : await db
    .select({
      id: users.id,
      discordUsername: users.discordUsername,
      discordGlobalName: users.discordGlobalName,
    })
    .from(users)
    .where(inArray(users.id, reviewerIds));
  const reviewerById = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer]));

  return c.json(rows.map((row) => ({
    ...row,
    reviewer: row.reviewedByUserId ? reviewerById.get(row.reviewedByUserId) ?? null : null,
  })));
});

async function review(c: Context<AppEnv>, status: "approved" | "rejected") {
  const body = c.req.header("Content-Type")?.includes("application/json")
    ? await parseBody(c, reviewApplicationSchema)
    : { reviewReason: null };
  if (body instanceof Response) return body;
  const id = c.req.param("id");
  if (!id) return c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
  const db = c.get("db");
  const reviewer = c.get("user");

  const app = await db.query.accessApplications.findFirst({
    where: eq(accessApplications.id, id),
  });
  if (!app) return c.json({ error: { code: "NOT_FOUND", message: "Application not found" } }, 404);
  if (app.status !== "pending") {
    return c.json({ error: { code: "ALREADY_REVIEWED", message: "Application already reviewed" } }, 400);
  }

  await db
    .update(accessApplications)
    .set({
      status,
      reviewedByUserId: reviewer.id,
      reviewedAt: new Date(),
      reviewReason: body.reviewReason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(accessApplications.id, id));

  // Approving promotes the applicant to member. Rejecting leaves them pending.
  if (status === "approved") {
    await db
      .update(users)
      .set({ role: "member", updatedAt: new Date() })
      .where(eq(users.id, app.userId));
  }

  const applicant = await db.query.users.findFirst({ where: eq(users.id, app.userId) });
  const action = status === "approved" ? "application.approve" : "application.reject";
  void audit(db, action, reviewer.id, {
    targetType: "application",
    targetId: id,
    metadata: {
      applicantUserId: app.userId,
      applicantName: applicant?.discordGlobalName ?? applicant?.discordUsername,
      reviewReason: body.reviewReason ?? null,
    },
  });
  void recordActivityEvent(db, {
    actorUserId: reviewer.id,
    eventType: action,
    targetType: "application",
    targetId: id,
    visibility: "system",
    metadata: { applicantUserId: app.userId },
  });

  const templateKey = status === "approved" ? "application.approved" : "application.rejected";
  void createNotificationFromTemplate(db, app.userId, templateKey, { reviewReason: body.reviewReason });

  // DM the applicant — fire-and-forget, never block the response
  if (c.env.DISCORD_BOT_TOKEN) {
    if (applicant) {
      void sendDM(
        c.env.DISCORD_BOT_TOKEN,
        applicant.discordId,
        applicationReviewDmTemplate(templateKey, c.env.APP_BASE_URL, { reviewReason: body.reviewReason }),
      );
    }
  }

  return c.json({ ok: true });
}

adminApplicationRoutes.post("/:id/approve", (c) => review(c, "approved"));
adminApplicationRoutes.post("/:id/reject", (c) => review(c, "rejected"));
