import { createDb } from "../../db/client";
import { sendChannelMessage } from "./discord";
import { buildCommunitySummary, getPublicRecentActivity } from "./watchBrief";
import type { Bindings } from "../env";

/**
 * Daily cron (0 9 * * *): post yesterday's community watch activity to the configured channel.
 * Skips silently if bot or channel not configured, or if there's nothing to report.
 */
export async function runDailySummary(env: Bindings): Promise<void> {
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_NOTIFICATION_CHANNEL_ID) return;

  const db = createDb(env.DATABASE_URL);
  const content = buildCommunitySummary(await getPublicRecentActivity(db, 20), env.APP_BASE_URL);
  if (!content) return;
  await sendChannelMessage(env.DISCORD_BOT_TOKEN, env.DISCORD_NOTIFICATION_CHANNEL_ID, content);
}
