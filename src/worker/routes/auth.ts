import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema";
import {
  buildAuthorizeUrl,
  exchangeCode,
  fetchDiscordUser,
  checkGuildMembership,
} from "../auth/discord";
import {
  randomState,
  createStateCookie,
  readState,
  clearStateCookie,
  createSessionCookie,
  clearSessionCookie,
} from "../auth/session";
import { permissionsForRole, requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { audit } from "../lib/audit";
import type { AppEnv } from "../env";
import type { MeResponse } from "../../shared/types";

export const authRoutes = new Hono<AppEnv>();

function adminIds(env: AppEnv["Bindings"]): Set<string> {
  return new Set(
    env.ADMIN_DISCORD_IDS.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

// Begin OAuth: set a signed state cookie and redirect to Discord.
authRoutes.get("/discord", (c) => {
  const state = randomState();
  c.header("Set-Cookie", createStateCookie(c.env.APP_BASE_URL, state));
  const url = buildAuthorizeUrl({
    clientId: c.env.DISCORD_CLIENT_ID,
    redirectUri: c.env.DISCORD_REDIRECT_URI,
    state,
  });
  return c.redirect(url, 302);
});

// OAuth callback: verify CSRF state, exchange code, upsert user, set session.
// Rate limited by IP to prevent callback spam.
authRoutes.get(
  "/discord/callback",
  rateLimit("auth:callback", "ip"),
  async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const cookieState = readState(c.req.header("Cookie") ?? null);

    // Always clear the state cookie regardless of outcome.
    c.header("Set-Cookie", clearStateCookie(c.env.APP_BASE_URL));

    if (!code || !state || !cookieState || state !== cookieState) {
      return c.redirect(`${c.env.APP_BASE_URL}/?error=oauth_state`, 302);
    }

    let accessToken: string;
    let discordUser;
    try {
      accessToken = await exchangeCode({
        clientId: c.env.DISCORD_CLIENT_ID,
        clientSecret: c.env.DISCORD_CLIENT_SECRET,
        redirectUri: c.env.DISCORD_REDIRECT_URI,
        code,
      });
      discordUser = await fetchDiscordUser(accessToken);
    } catch {
      return c.redirect(`${c.env.APP_BASE_URL}/?error=oauth_failed`, 302);
    }

    // Guild membership gate — blocks login if user is not in the community server.
    if (c.env.DISCORD_GUILD_ID && c.env.DISCORD_BOT_TOKEN) {
      try {
        const inGuild = await checkGuildMembership(c.env.DISCORD_BOT_TOKEN, c.env.DISCORD_GUILD_ID, discordUser.id);
        if (!inGuild) {
          return c.redirect(`${c.env.APP_BASE_URL}/?error=not_in_guild`, 302);
        }
      } catch {
        // ponytail: fail-open on bot misconfiguration to avoid total lockout
        console.error("Guild membership check error — proceeding without gate");
      }
    }

    const db = c.get("db");
    const existing = await db.query.users.findFirst({
      where: eq(users.discordId, discordUser.id),
    });

    if (existing?.role === "banned") {
      return c.redirect(`${c.env.APP_BASE_URL}/?error=banned`, 302);
    }

    let userId: string;
    let role = existing?.role ?? "pending";

    if (existing) {
      await db
        .update(users)
        .set({
          discordUsername: discordUser.username,
          discordGlobalName: discordUser.global_name,
          discordAvatar: discordUser.avatar,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id));
      userId = existing.id;
    } else {
      // First login: owner if listed in ADMIN_DISCORD_IDS, otherwise pending.
      role = adminIds(c.env).has(discordUser.id) ? "owner" : "pending";
      const inserted = await db
        .insert(users)
        .values({
          discordId: discordUser.id,
          discordUsername: discordUser.username,
          discordGlobalName: discordUser.global_name,
          discordAvatar: discordUser.avatar,
          role,
          lastLoginAt: new Date(),
        })
        .returning({ id: users.id });
      userId = inserted[0]!.id;
    }

    // Audit login (fire-and-forget)
    void audit(db, "user.login", userId, {
      ip: c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0]?.trim(),
      ua: c.req.header("User-Agent"),
      metadata: { discordId: discordUser.id },
    });

    // Append the session cookie (Hono merges multiple Set-Cookie headers).
    c.header(
      "Set-Cookie",
      await createSessionCookie(c.env.SESSION_SECRET, c.env.APP_BASE_URL, userId),
      { append: true },
    );

    const dest = role === "pending" ? "/apply" : "/app";
    return c.redirect(`${c.env.APP_BASE_URL}${dest}`, 302);
  },
);

authRoutes.post("/logout", requireAuth, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  void audit(db, "user.logout", user.id, {
    ip: c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0]?.trim(),
  });
  c.header("Set-Cookie", clearSessionCookie(c.env.APP_BASE_URL));
  return c.json({ ok: true });
});

// Mounted separately at /api/me in index.ts, but kept here for cohesion.
export const meRoute = new Hono<AppEnv>();
meRoute.get("/", requireAuth, async (c) => {
  const u = c.get("user");
  const body: MeResponse = {
    id: u.id,
    discordId: u.discordId,
    discordUsername: u.discordUsername,
    discordGlobalName: u.discordGlobalName,
    discordAvatar: u.discordAvatar,
    role: u.role as MeResponse["role"],
    permissions: await permissionsForRole(c.get("db"), u.role as MeResponse["role"]),
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  };
  return c.json(body);
});
