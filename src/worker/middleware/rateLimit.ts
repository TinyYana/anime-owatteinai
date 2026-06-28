import { createMiddleware } from "hono/factory";
import { sql } from "drizzle-orm";
import type { AppEnv } from "../env";

// All rate limit configs in one place. Edit here, applies everywhere.
export const RATE_LIMITS = {
  "anime:search":        { windowSec: 60,   max: 20 },
  "anime:import":        { windowSec: 3600, max: 30 },
  "watchsession:create": { windowSec: 60,   max: 30 },
  "application:submit":  { windowSec: 3600, max: 3 },
  "auth:callback":       { windowSec: 60,   max: 30 },
} as const satisfies Record<string, { windowSec: number; max: number }>;

type RateLimitKey = keyof typeof RATE_LIMITS;

function clientIp(req: Request): string {
  return (
    req.headers.get("CF-Connecting-IP") ??
    req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Atomic sliding-window rate limiter backed by `aon.rate_limits`.
 *
 * Uses a single INSERT … ON CONFLICT DO UPDATE … RETURNING to atomically
 * increment the counter, eliminating the read-then-write race condition
 * of a two-query approach.
 *
 * subject="user" uses the authenticated user's ID (requires requireAuth first).
 * subject="ip"   uses the client IP (safe for unauthenticated routes).
 */
export function rateLimit(action: RateLimitKey, subject: "user" | "ip" = "user") {
  return createMiddleware<AppEnv>(async (c, next) => {
    const { windowSec, max } = RATE_LIMITS[action];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subjectId = subject === "ip" ? clientIp(c.req.raw) : ((c.get("user") as any)?.id ?? "anon");
    const key = `${subjectId}:${action}`;

    try {
      const db = c.get("db");

      // Atomically upsert the counter. make_interval(secs=>) lets us pass the
      // window duration as a parameter without string concatenation.
      const result = await db.execute(sql`
        INSERT INTO aon.rate_limits (key, count, window_start)
        VALUES (${key}, 1, NOW())
        ON CONFLICT (key) DO UPDATE SET
          count = CASE
            WHEN aon.rate_limits.window_start < NOW() - make_interval(secs => ${windowSec})
              THEN 1
            ELSE aon.rate_limits.count + 1
          END,
          window_start = CASE
            WHEN aon.rate_limits.window_start < NOW() - make_interval(secs => ${windowSec})
              THEN NOW()
            ELSE aon.rate_limits.window_start
          END
        RETURNING count
      `);

      const count = (result.rows[0] as { count: number } | undefined)?.count ?? 1;
      if (count > max) {
        return c.json(
          { error: { code: "RATE_LIMITED", message: "Too many requests, please slow down" } },
          429,
        );
      }
    } catch {
      // Fail open — never block a request because the rate limiter errored
    }

    await next();
  });
}
