import { Hono } from "hono";
import { and, desc, eq, inArray } from "drizzle-orm";
import { verifyDiscordSignature } from "../lib/discord";
import { buildPersonalTodayBrief } from "../lib/watchBrief";
import { userAnime, anime, users } from "../../db/schema";
import type { AppEnv } from "../env";

// Discord interaction type constants
const PING = 1;
const APPLICATION_COMMAND = 2;
// Discord response type constants
const PONG = 1;
const CHANNEL_MESSAGE = 4;
// Message flags
const EPHEMERAL = 64;

type InteractionOption = { name: string; value?: string; options?: InteractionOption[] };
type InteractionBody = {
  type: number;
  data?: { name: string; options?: InteractionOption[] };
  member?: { user?: { id: string } };
  user?: { id: string };
};

function reply(content: string, ephemeral = false) {
  return { type: CHANNEL_MESSAGE, data: { content, ...(ephemeral ? { flags: EPHEMERAL } : {}) } };
}

export const discordRoutes = new Hono<AppEnv>();

discordRoutes.post("/interactions", async (c) => {
  const publicKey = c.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) return c.json({ error: "Not configured" }, 503);

  const signature = c.req.header("x-signature-ed25519") ?? "";
  const timestamp = c.req.header("x-signature-timestamp") ?? "";
  const rawBody = await c.req.text();

  if (!(await verifyDiscordSignature(publicKey, signature, timestamp, rawBody))) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const body = JSON.parse(rawBody) as InteractionBody;
  if (body.type === PING) return c.json({ type: PONG });
  if (body.type !== APPLICATION_COMMAND || body.data?.name !== "anime") {
    return c.json(reply("未知指令。", true));
  }

  const sub = body.data.options?.[0];
  const db = c.get("db");
  const discordId = body.member?.user?.id ?? body.user?.id;

  // /anime today — public community activity feed
  if (sub?.name === "today") {
    if (!discordId) return c.json(reply("無法識別你的 Discord 帳號。", true));
    return c.json(reply(await buildPersonalTodayBrief(db, discordId), true));
  }

  // /anime watching — ephemeral list of user's current watches
  if (sub?.name === "watching") {
    if (!discordId) return c.json(reply("無法識別你的 Discord 帳號。", true));
    const user = await db.query.users.findFirst({ where: eq(users.discordId, discordId) });
    if (!user) return c.json(reply("你還沒有在追番進行式建立帳號。", true));

    const watching = await db
      .select({ currentEpisode: userAnime.currentEpisode, animeTitle: anime.titleZh, animeTitleFallback: anime.title })
      .from(userAnime)
      .innerJoin(anime, eq(anime.id, userAnime.animeId))
      .where(and(eq(userAnime.userId, user.id), eq(userAnime.status, "watching")))
      .orderBy(desc(userAnime.updatedAt))
      .limit(10);

    if (watching.length === 0) return c.json(reply("你目前沒有進行中的追番。", true));
    const lines = watching.map((w) => `· **${w.animeTitle ?? w.animeTitleFallback}** — EP${w.currentEpisode}`);
    return c.json(reply(`📋 **你正在追的作品**\n${lines.join("\n")}`, true));
  }

  // /anime share <title> — public share
  if (sub?.name === "share") {
    if (!discordId) return c.json(reply("無法識別你的 Discord 帳號。", true));
    const user = await db.query.users.findFirst({ where: eq(users.discordId, discordId) });
    if (!user) return c.json(reply("你還沒有在追番進行式建立帳號。", true));

    const query = (sub.options?.find((o) => o.name === "title")?.value ?? "").toLowerCase();
    const watching = await db
      .select({
        currentEpisode: userAnime.currentEpisode,
        episodesTotal: anime.episodesTotal,
        animeTitle: anime.titleZh,
        animeTitleFallback: anime.title,
      })
      .from(userAnime)
      .innerJoin(anime, eq(anime.id, userAnime.animeId))
      .where(and(eq(userAnime.userId, user.id), inArray(userAnime.status, ["watching", "planned"])))
      .orderBy(desc(userAnime.updatedAt))
      .limit(50);

    const match = watching.find((w) => (w.animeTitle ?? w.animeTitleFallback).toLowerCase().includes(query));
    if (!match) return c.json(reply(`找不到「${query}」在你的追番清單裡。`, true));

    const title = match.animeTitle ?? match.animeTitleFallback;
    const progress = match.episodesTotal ? `EP${match.currentEpisode} / ${match.episodesTotal}` : `EP${match.currentEpisode}`;
    const displayName = user.discordGlobalName ?? user.discordUsername;
    return c.json(reply(`📢 **${displayName}** 正在追 **${title}**，看到 ${progress}！`));
  }

  return c.json(reply("未知子指令。", true));
});
