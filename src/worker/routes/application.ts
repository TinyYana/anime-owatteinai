import { Hono } from "hono";
import type { Context } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { accessApplications, users } from "../../db/schema";
import { requireAuth, requirePermission } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { parseBody } from "../util";
import { createApplicationSchema } from "../../shared/validators";
import { audit } from "../lib/audit";
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

async function review(c: Context<AppEnv>, status: "approved" | "rejected") {
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

  const action = status === "approved" ? "application.approve" : "application.reject";
  void audit(db, action, reviewer.id, {
    targetType: "application",
    targetId: id,
    metadata: { applicantUserId: app.userId },
  });

  // DM the applicant — fire-and-forget, never block the response
  if (c.env.DISCORD_BOT_TOKEN) {
    const applicant = await db.query.users.findFirst({ where: eq(users.id, app.userId) });
    if (applicant) {
      const msg =
        status === "approved"
          ? `✅ 你的追番進行式申請已通過！歡迎加入，馬上登入開始追番：${c.env.APP_BASE_URL}/app`
          : `❌ 你的追番進行式申請未通過。有問題請聯繫管理員。`;
      void sendDM(c.env.DISCORD_BOT_TOKEN, applicant.discordId, msg);
    }
  }

  return c.json({ ok: true });
}

adminApplicationRoutes.post("/:id/approve", (c) => review(c, "approved"));
adminApplicationRoutes.post("/:id/reject", (c) => review(c, "rejected"));
