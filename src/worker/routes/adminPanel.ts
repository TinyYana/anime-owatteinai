import { Hono } from "hono";
import { eq, desc, count, sql, and } from "drizzle-orm";
import {
  users,
  anime,
  userAnime,
  watchSessions,
  sourceLinks,
  accessApplications,
  animeEditRequests,
  rolePermissions,
} from "../../db/schema";
import { requireAuth, requireAdmin, requirePermission } from "../middleware/auth";
import { parseBody } from "../util";
import { reviewAnimeEditRequestSchema } from "../../shared/validators";
import { audit } from "../lib/audit";
import { registerSlashCommands } from "../lib/discord";
import { z } from "zod";
import type { AppEnv } from "../env";
import {
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_PERMISSIONS,
  USER_ROLES,
} from "../../shared/types";
import type { RolePermission, RolePermissionConfig, UserRole } from "../../shared/types";

export const adminPanelRoutes = new Hono<AppEnv>();
adminPanelRoutes.use("*", requireAuth, requireAdmin);

const updateRoleSchema = z.object({
  role: z.enum(USER_ROLES as [UserRole, ...UserRole[]]),
});

const updateRolePermissionsSchema = z.object({
  permissions: z.array(z.enum(ROLE_PERMISSIONS as [RolePermission, ...RolePermission[]])),
});

function isMissingEditRequestTable(err: unknown) {
  return String(err).includes("anime_edit_requests");
}

function roleConfig(rows: Array<{ role: string; permission: RolePermission; enabled: boolean }>, role: UserRole): RolePermissionConfig {
  if (role === "owner") return { role, permissions: [...ROLE_PERMISSIONS] };
  const roleRows = rows.filter((row) => row.role === role);
  const permissions =
    roleRows.length > 0
      ? ROLE_PERMISSIONS.filter((permission) => roleRows.some((row) => row.permission === permission && row.enabled))
      : [...DEFAULT_ROLE_PERMISSIONS[role]];
  return { role, permissions };
}

// GET /api/admin/panel/roles — list role permission settings
adminPanelRoutes.get("/roles", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select({
      role: rolePermissions.role,
      permission: rolePermissions.permission,
      enabled: rolePermissions.enabled,
    })
    .from(rolePermissions);
  return c.json(USER_ROLES.map((role) => roleConfig(rows, role)));
});

// PUT /api/admin/panel/roles/:role/permissions — replace one role's enabled permissions
adminPanelRoutes.put("/roles/:role/permissions", requirePermission("roles.manage", "FORBIDDEN", "Role permission access required"), async (c) => {
  const role = c.req.param("role") as UserRole;
  if (!USER_ROLES.includes(role)) return c.json({ error: { code: "INVALID_ROLE", message: "Invalid role" } }, 400);
  if (role === "owner") return c.json({ error: { code: "OWNER_IMMUTABLE", message: "Owner always has every permission" } }, 400);

  const body = await parseBody(c, updateRolePermissionsSchema);
  if (body instanceof Response) return body;

  const enabled = new Set(body.permissions);
  const values = ROLE_PERMISSIONS.map((permission) => ({
    role,
    permission,
    enabled: enabled.has(permission),
    updatedAt: new Date(),
  }));
  const db = c.get("db");
  await db
    .insert(rolePermissions)
    .values(values)
    .onConflictDoUpdate({
      target: [rolePermissions.role, rolePermissions.permission],
      set: { enabled: sql`excluded.enabled`, updatedAt: new Date() },
    });

  void audit(db, "role.permissions_change", c.get("user").id, {
    targetType: "role",
    targetId: role,
    metadata: { permissions: body.permissions },
  });

  return c.json({ role, permissions: ROLE_PERMISSIONS.filter((permission) => enabled.has(permission)) });
});

// GET /api/admin/panel/users — list all users
adminPanelRoutes.get("/users", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select({
      id: users.id,
      discordId: users.discordId,
      discordUsername: users.discordUsername,
      discordGlobalName: users.discordGlobalName,
      discordAvatar: users.discordAvatar,
      role: users.role,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      animeCount: count(userAnime.id),
    })
    .from(users)
    .leftJoin(userAnime, eq(userAnime.userId, users.id))
    .groupBy(users.id)
    .orderBy(desc(users.createdAt));
  return c.json(rows);
});

// PATCH /api/admin/panel/users/:id — change role
adminPanelRoutes.patch("/users/:id", requirePermission("users.manage", "FORBIDDEN", "User management access required"), async (c) => {
  const body = await parseBody(c, updateRoleSchema);
  if (body instanceof Response) return body;
  const db = c.get("db");
  const me = c.get("user");

  // Prevent self-demotion from owner
  if (c.req.param("id") === me.id && me.role === "owner" && body.role !== "owner") {
    return c.json({ error: { code: "CANNOT_DEMOTE_SELF", message: "Cannot demote yourself from owner" } }, 400);
  }

  const target = await db.query.users.findFirst({ where: eq(users.id, c.req.param("id")) });
  if (!target) return c.json({ error: { code: "NOT_FOUND", message: "User not found" } }, 404);

  const [updated] = await db
    .update(users)
    .set({ role: body.role as typeof users.$inferSelect.role, updatedAt: new Date() })
    .where(eq(users.id, c.req.param("id")))
    .returning({ id: users.id, role: users.role });
  if (!updated) return c.json({ error: { code: "NOT_FOUND", message: "User not found" } }, 404);

  void audit(db, "user.role_change", me.id, {
    targetType: "user",
    targetId: updated.id,
    metadata: { from: target.role, to: body.role },
  });

  return c.json(updated);
});

// GET /api/admin/panel/stats — aggregate counts
adminPanelRoutes.get("/stats", async (c) => {
  const db = c.get("db");
  const [[userStats], [animeCount], [sessionCount], [pendingCount], [pendingEditCount]] =
    await Promise.all([
      db.select({
        total: count(),
        members: sql<number>`count(*) filter (where ${users.role}::text = 'member')`,
        admins: sql<number>`count(*) filter (where ${users.role}::text in ('admin','owner','moderator'))`,
        moderators: sql<number>`count(*) filter (where ${users.role}::text = 'moderator')`,
        pending: sql<number>`count(*) filter (where ${users.role}::text = 'pending')`,
        banned: sql<number>`count(*) filter (where ${users.role}::text = 'banned')`,
      }).from(users),
      db.select({ total: count() }).from(anime),
      db.select({ total: count() }).from(watchSessions),
      db.select({ total: count() }).from(accessApplications).where(eq(accessApplications.status, "pending")),
      db
        .select({ total: count() })
        .from(animeEditRequests)
        .where(eq(animeEditRequests.status, "pending"))
        .catch((err) => {
          if (isMissingEditRequestTable(err)) return [{ total: 0 }];
          throw err;
        }),
    ]);
  return c.json({
    users: userStats,
    animeTotal: animeCount!.total,
    sessionTotal: sessionCount!.total,
    pendingApplications: pendingCount!.total,
    pendingEditRequests: pendingEditCount!.total,
  });
});

adminPanelRoutes.get("/edit-requests", async (c) => {
  const db = c.get("db");
  try {
    const rows = await db
      .select({
        id: animeEditRequests.id,
        animeId: animeEditRequests.animeId,
        userId: animeEditRequests.userId,
        status: animeEditRequests.status,
        payload: animeEditRequests.payload,
        note: animeEditRequests.note,
        reviewedByUserId: animeEditRequests.reviewedByUserId,
        reviewedAt: animeEditRequests.reviewedAt,
        createdAt: animeEditRequests.createdAt,
        updatedAt: animeEditRequests.updatedAt,
        animeTitle: anime.titleZh,
        animeTitleFallback: anime.title,
        userName: users.discordGlobalName,
      })
      .from(animeEditRequests)
      .innerJoin(anime, eq(anime.id, animeEditRequests.animeId))
      .innerJoin(users, eq(users.id, animeEditRequests.userId))
      .orderBy(desc(animeEditRequests.createdAt))
      .limit(100);
    return c.json(rows);
  } catch (err) {
    if (isMissingEditRequestTable(err)) return c.json([]);
    throw err;
  }
});

adminPanelRoutes.post("/edit-requests/:id/review", requirePermission("anime.manage", "FORBIDDEN", "Anime management access required"), async (c) => {
  const body = await parseBody(c, reviewAnimeEditRequestSchema);
  if (body instanceof Response) return body;
  const db = c.get("db");
  const request = await db.query.animeEditRequests.findFirst({
    where: eq(animeEditRequests.id, c.req.param("id")),
  });
  if (!request) return c.json({ error: { code: "NOT_FOUND", message: "Edit request not found" } }, 404);
  if (request.status !== "pending") {
    return c.json({ error: { code: "ALREADY_REVIEWED", message: "Already reviewed" } }, 400);
  }

  if (body.action === "approve") {
    await db
      .update(anime)
      .set({ ...request.payload, updatedAt: new Date() })
      .where(eq(anime.id, request.animeId));
  }

  const [updated] = await db
    .update(animeEditRequests)
    .set({
      status: body.action === "approve" ? "approved" : "rejected",
      reviewedByUserId: c.get("user").id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(animeEditRequests.id, request.id))
    .returning();
  return c.json(updated);
});

// GET /api/admin/panel/activity — recent watch sessions across all users
adminPanelRoutes.get("/activity", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select({
      id: watchSessions.id,
      animeId: watchSessions.animeId,
      episodeNumber: watchSessions.episodeNumber,
      completed: watchSessions.completed,
      watchedAt: watchSessions.watchedAt,
      userName: users.discordGlobalName,
      animeTitle: anime.titleZh,
      animeTitleFallback: anime.title,
    })
    .from(watchSessions)
    .innerJoin(users, eq(users.id, watchSessions.userId))
    .innerJoin(anime, eq(anime.id, watchSessions.animeId))
    .orderBy(desc(watchSessions.watchedAt))
    .limit(50);
  return c.json(rows);
});

// --- Alias management ---

const removeAliasSchema = z.object({ alias: z.string().min(1).max(300) });

// DELETE /api/admin/panel/anime/:id/alias — remove one synonym by exact value
adminPanelRoutes.delete("/anime/:id/alias", requirePermission("anime.manage", "FORBIDDEN", "Anime management access required"), async (c) => {
  const body = await parseBody(c, removeAliasSchema);
  if (body instanceof Response) return body;
  const db = c.get("db");

  const row = await db.query.anime.findFirst({ where: eq(anime.id, c.req.param("id")) });
  if (!row) return c.json({ error: { code: "NOT_FOUND", message: "Anime not found" } }, 404);

  const current = row.synonyms ?? [];
  const next = current.filter((s) => s !== body.alias);
  if (next.length === current.length) {
    return c.json({ error: { code: "NOT_FOUND", message: "Alias not found in synonyms" } }, 404);
  }

  const [updated] = await db
    .update(anime)
    .set({ synonyms: next.length > 0 ? next : null, updatedAt: new Date() })
    .where(eq(anime.id, row.id))
    .returning();

  void audit(db, "alias.delete", c.get("user").id, {
    targetType: "anime",
    targetId: row.id,
    metadata: { removedAlias: body.alias },
  });

  return c.json(updated);
});

// GET /api/admin/panel/anime/:id/aliases — list all synonyms
adminPanelRoutes.get("/anime/:id/aliases", async (c) => {
  const db = c.get("db");
  const row = await db.query.anime.findFirst({ where: eq(anime.id, c.req.param("id")) });
  if (!row) return c.json({ error: { code: "NOT_FOUND", message: "Anime not found" } }, 404);
  return c.json({ animeId: row.id, title: row.title, aliases: row.synonyms ?? [] });
});

// --- Anime merge ---

const mergeAnimeSchema = z.object({
  targetId: z.string().uuid(),
});

/**
 * POST /api/admin/panel/anime/:id/merge
 * Merge anime :id (source) INTO targetId (kept), then delete source.
 *
 * - Users tracking only source → their tracking moves to target.
 * - Users tracking both → source tracking deleted, target kept.
 * - Watch sessions, source links → moved to target.
 * - Source's titles + synonyms → merged into target's synonyms.
 * - Source anime row deleted (cascades remaining FK refs).
 */
adminPanelRoutes.post("/anime/:id/merge", requirePermission("anime.manage", "FORBIDDEN", "Anime management access required"), async (c) => {
  const body = await parseBody(c, mergeAnimeSchema);
  if (body instanceof Response) return body;

  const sourceId = c.req.param("id");
  const { targetId } = body;

  if (sourceId === targetId) {
    return c.json({ error: { code: "INVALID", message: "Source and target must differ" } }, 400);
  }

  const db = c.get("db");
  const [source, target] = await Promise.all([
    db.query.anime.findFirst({ where: eq(anime.id, sourceId) }),
    db.query.anime.findFirst({ where: eq(anime.id, targetId) }),
  ]);
  if (!source) return c.json({ error: { code: "NOT_FOUND", message: "Source anime not found" } }, 404);
  if (!target) return c.json({ error: { code: "NOT_FOUND", message: "Target anime not found" } }, 404);

  // Users who track BOTH: delete the source tracking row (keep target's).
  // Users who track ONLY source: move their row to target.
  const sourceTracking = await db.select({ userId: userAnime.userId, id: userAnime.id })
    .from(userAnime)
    .where(eq(userAnime.animeId, sourceId));

  for (const row of sourceTracking) {
    const hasTarget = await db.query.userAnime.findFirst({
      where: and(eq(userAnime.userId, row.userId), eq(userAnime.animeId, targetId)),
    });
    if (hasTarget) {
      // User tracks both — drop the source entry
      await db.delete(userAnime).where(eq(userAnime.id, row.id));
    } else {
      // User only tracks source — move to target
      await db.update(userAnime)
        .set({ animeId: targetId, updatedAt: new Date() })
        .where(eq(userAnime.id, row.id));
    }
  }

  // Move all watch sessions and source links to target
  await db.update(watchSessions).set({ animeId: targetId }).where(eq(watchSessions.animeId, sourceId));
  await db.update(sourceLinks).set({ animeId: targetId, updatedAt: new Date() }).where(eq(sourceLinks.animeId, sourceId));

  // Merge source's titles + synonyms into target's synonyms (deduped)
  const seen = new Set((target.synonyms ?? []).map((s) => s.toLowerCase()));
  const additions: string[] = [];
  const candidates = [
    source.title, source.titleZh, source.titleJp,
    source.titleRomaji, source.titleEnglish, source.titleNative,
    ...(source.synonyms ?? []),
  ];
  for (const s of candidates) {
    if (!s) continue;
    const key = s.toLowerCase();
    if (!seen.has(key)) { seen.add(key); additions.push(s); }
  }
  const mergedSynonyms = [...(target.synonyms ?? []), ...additions];

  const [merged] = await db.update(anime)
    .set({ synonyms: mergedSynonyms.length > 0 ? mergedSynonyms : null, updatedAt: new Date() })
    .where(eq(anime.id, targetId))
    .returning();

  // Delete source (cascades remaining edit requests etc.)
  await db.delete(anime).where(eq(anime.id, sourceId));

  void audit(db, "anime.merge", c.get("user").id, {
    targetType: "anime",
    targetId,
    metadata: { sourceId, sourceTitle: source.title, targetTitle: target.title },
  });

  return c.json({ ok: true, merged });
});

// --- Test data management ---

const testSeedSchema = z.object({
  flow: z.enum(["application", "member"]),
});

// GET /api/admin/panel/test/users — list all test (is_test=true) users
adminPanelRoutes.get("/test/users", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select({
      id: users.id,
      discordId: users.discordId,
      discordUsername: users.discordUsername,
      discordGlobalName: users.discordGlobalName,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.isTest, true))
    .orderBy(desc(users.createdAt));
  return c.json(rows);
});

// POST /api/admin/panel/test/seed — create test data for a specific flow
adminPanelRoutes.post("/test/seed", async (c) => {
  const body = await parseBody(c, testSeedSchema);
  if (body instanceof Response) return body;

  const db = c.get("db");
  const ts = Date.now();
  const [testUser] = await db
    .insert(users)
    .values({
      discordId: `TEST:${ts}`,
      discordUsername: `test_${ts}`,
      discordGlobalName: `[測試] ${body.flow === "member" ? "成員" : "申請者"}`,
      role: body.flow === "member" ? "member" : "pending",
      isTest: true,
    })
    .returning();
  if (!testUser) return c.json({ error: { code: "SEED_FAILED", message: "Failed to create test user" } }, 500);

  if (body.flow === "application") {
    await db.insert(accessApplications).values({
      userId: testUser.id,
      message: "[自動測試申請] 請在審核申請頁面測試審核流程。完成後請刪除測試資料。",
      status: "pending",
    });
  }

  return c.json({ user: testUser }, 201);
});

// DELETE /api/admin/panel/test/cleanup — delete all test users and their cascaded data
adminPanelRoutes.delete("/test/cleanup", async (c) => {
  const db = c.get("db");
  const deleted = await db.delete(users).where(eq(users.isTest, true)).returning({ id: users.id });
  return c.json({ deleted: deleted.length });
});

// POST /api/admin/discord/register-commands — register slash commands with Discord
adminPanelRoutes.post("/discord/register-commands", async (c) => {
  const { DISCORD_CLIENT_ID, DISCORD_BOT_TOKEN } = c.env;
  if (!DISCORD_CLIENT_ID || !DISCORD_BOT_TOKEN) {
    return c.json({ error: { code: "NOT_CONFIGURED", message: "DISCORD_CLIENT_ID / DISCORD_BOT_TOKEN 未設定" } }, 503);
  }
  const result = await registerSlashCommands(DISCORD_CLIENT_ID, DISCORD_BOT_TOKEN);
  if (!result.ok) return c.json({ error: { code: "DISCORD_ERROR", message: `Discord API 回應 ${result.status}` } }, 502);
  return c.json({ ok: true });
});

// GET /api/admin/discord/status — which Discord features are configured
adminPanelRoutes.get("/discord/status", (c) => {
  return c.json({
    botToken: !!c.env.DISCORD_BOT_TOKEN,
    guildId: !!c.env.DISCORD_GUILD_ID,
    publicKey: !!c.env.DISCORD_PUBLIC_KEY,
    notificationChannelId: !!c.env.DISCORD_NOTIFICATION_CHANNEL_ID,
  });
});

// GET /api/admin/panel/audit-logs — recent audit trail
adminPanelRoutes.get("/audit-logs", requirePermission("audit.view", "FORBIDDEN", "Audit log access required"), async (c) => {
  const db = c.get("db");
  const { auditLogs } = await import("../../db/schema");
  const rows = await db
    .select({
      id: auditLogs.id,
      actorUserId: auditLogs.actorUserId,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      createdAt: auditLogs.createdAt,
      actorName: users.discordGlobalName,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);
  return c.json(rows);
});
