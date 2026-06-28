import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { createDb } from "../../db/client";
import { users } from "../../db/schema";
import { sendDM } from "./discord";
import { buildPersonalTodayBrief } from "./watchBrief";
import type { Bindings } from "../env";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Daily opt-in DM notifications.
 * No Gateway, no long-running bot: cron wakes the Worker, sends REST DMs, exits.
 */
export async function runPersonalDailyNotifications(env: Bindings): Promise<void> {
  if (!env.DISCORD_BOT_TOKEN) return;

  const db = createDb(env.DATABASE_URL);
  const cutoff = new Date(Date.now() - DAY_MS + 5 * 60 * 1000);
  const targets = await db
    .select({
      id: users.id,
      discordId: users.discordId,
      dailyDmIncludeCommunity: users.dailyDmIncludeCommunity,
    })
    .from(users)
    .where(
      and(
        eq(users.dailyDmEnabled, true),
        eq(users.isTest, false),
        inArray(users.role, ["owner", "admin", "moderator", "member"]),
        or(isNull(users.dailyDmLastSentAt), lt(users.dailyDmLastSentAt, cutoff)),
      ),
    )
    .limit(100);

  for (const target of targets) {
    const content = await buildPersonalTodayBrief(db, target.discordId, target.dailyDmIncludeCommunity);
    const ok = await sendDM(env.DISCORD_BOT_TOKEN, target.discordId, content);
    if (ok) {
      await db.update(users).set({ dailyDmLastSentAt: new Date(), updatedAt: new Date() }).where(eq(users.id, target.id));
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
