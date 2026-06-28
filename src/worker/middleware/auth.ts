import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { createDb } from "../../db/client";
import { users, rolePermissions } from "../../db/schema";
import { readSession, clearSessionCookie } from "../auth/session";
import { DEFAULT_ROLE_PERMISSIONS, ROLE_PERMISSIONS } from "../../shared/types";
import type { RolePermission, UserRole } from "../../shared/types";
import type { DB } from "../../db/client";
import type { AppEnv } from "../env";

/** Attach a per-request Drizzle client. */
export const withDb = createMiddleware<AppEnv>(async (c, next) => {
  c.set("db", createDb(c.env.DATABASE_URL));
  await next();
});

/**
 * Require a valid session and load the user. Bans are enforced here: a banned
 * user is logged out and rejected. Sets `user` in context on success.
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const session = await readSession(c.env.SESSION_SECRET, c.req.header("Cookie") ?? null);
  if (!session) {
    return c.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }, 401);
  }

  const db = c.get("db");
  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  if (!user) {
    c.header("Set-Cookie", clearSessionCookie(c.env.APP_BASE_URL));
    return c.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }, 401);
  }
  if (user.role === "banned") {
    c.header("Set-Cookie", clearSessionCookie(c.env.APP_BASE_URL));
    return c.json({ error: { code: "BANNED", message: "Account banned" } }, 403);
  }

  c.set("user", user);
  await next();
});

function isMissingRolePermissionsTable(err: unknown) {
  return String(err).includes("role_permissions");
}

export async function permissionsForRole(db: DB, role: UserRole): Promise<RolePermission[]> {
  if (role === "owner") return [...ROLE_PERMISSIONS];
  try {
    const rows = await db
      .select({ permission: rolePermissions.permission, enabled: rolePermissions.enabled })
      .from(rolePermissions)
      .where(eq(rolePermissions.role, role));
    if (rows.length === 0) return [...DEFAULT_ROLE_PERMISSIONS[role]];
    const enabled = new Set(rows.filter((row) => row.enabled).map((row) => row.permission));
    return ROLE_PERMISSIONS.filter((permission) => enabled.has(permission));
  } catch (err) {
    if (isMissingRolePermissionsTable(err)) return [...DEFAULT_ROLE_PERMISSIONS[role]];
    throw err;
  }
}

export async function roleHasPermission(db: DB, role: UserRole, permission: RolePermission): Promise<boolean> {
  return (await permissionsForRole(db, role)).includes(permission);
}

export function requirePermission(permission: RolePermission, code: string, message: string) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get("user");
    if (!(await roleHasPermission(c.get("db"), user.role as UserRole, permission))) {
      return c.json({ error: { code, message } }, 403);
    }
    await next();
  });
}

/** member / admin / owner — past the application gate. Pending users get 403. */
export const requireAppAccess = requirePermission("app.access", "APPLICATION_REQUIRED", "Membership required");

/** Roles with the admin panel permission. */
export const requireAdmin = requirePermission("admin.access", "FORBIDDEN", "Admin access required");
