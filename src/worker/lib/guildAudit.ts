import { eq, inArray, and } from "drizzle-orm";
import { createDb } from "../../db/client";
import { users } from "../../db/schema";
import { checkGuildMembership } from "../auth/discord";
import { audit } from "./audit";
import type { Bindings } from "../env";

/**
 * Hourly cron: revoke access for any user who has left the guild.
 * Sets their role to "pending" so they must re-apply after re-joining.
 * Skips test users (fake Discord IDs).
 */
export async function runGuildAudit(env: Bindings): Promise<void> {
  if (!env.DISCORD_GUILD_ID || !env.DISCORD_BOT_TOKEN) return;

  const db = createDb(env.DATABASE_URL);
  const activeUsers = await db
    .select({ id: users.id, discordId: users.discordId, role: users.role })
    .from(users)
    .where(
      and(
        inArray(users.role, ["owner", "admin", "moderator", "member"]),
        eq(users.isTest, false),
      ),
    );

  for (const user of activeUsers) {
    try {
      const inGuild = await checkGuildMembership(env.DISCORD_BOT_TOKEN, env.DISCORD_GUILD_ID, user.discordId);
      if (!inGuild) {
        await db.update(users).set({ role: "pending", updatedAt: new Date() }).where(eq(users.id, user.id));
        void audit(db, "user.guild_revoked", null, {
          targetType: "user",
          targetId: user.id,
          metadata: { previousRole: user.role, discordId: user.discordId },
        });
      }
    } catch {
      // Skip this user on Discord API errors — don't accidentally revoke on outages.
    }
    // ponytail: 200ms throttle — Discord bot rate limit is ~50 req/s; enough headroom for any plausible community size
    await new Promise<void>((r) => setTimeout(r, 200));
  }
}
