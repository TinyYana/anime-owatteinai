const DISCORD_API = "https://discord.com/api/v10";

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Verify a Discord interaction request signature using Ed25519 (Web Crypto).
 * Returns false on any error so callers can safely 401 without crashing.
 */
export async function verifyDiscordSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      hexToBytes(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      "Ed25519",
      key,
      hexToBytes(signature),
      new TextEncoder().encode(timestamp + body),
    );
  } catch {
    return false;
  }
}

/** POST a message to a Discord text channel. Fire-and-forget errors. */
export async function sendChannelMessage(botToken: string, channelId: string, content: string): Promise<void> {
  await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  }).catch((err) => console.error("Discord sendChannelMessage error:", err));
}

/**
 * Open a DM channel with a user, then send them a message.
 * Fails silently — DM failures shouldn't break the calling flow.
 */
export async function sendDM(botToken: string, discordUserId: string, content: string): Promise<void> {
  try {
    const channelRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: discordUserId }),
    });
    if (!channelRes.ok) return;
    const channel = (await channelRes.json()) as { id?: string };
    if (!channel.id) return;
    await sendChannelMessage(botToken, channel.id, content);
  } catch (err) {
    console.error("Discord sendDM error:", err);
  }
}

/**
 * Register (or replace) slash commands for this app globally.
 * Only needs to run once — call from admin panel.
 */
export async function registerSlashCommands(clientId: string, botToken: string): Promise<{ ok: boolean; status: number }> {
  const commands = [
    {
      name: "anime",
      description: "追番進行式指令",
      options: [
        { name: "today", description: "查看今日社群追番動態", type: 1 },
        { name: "watching", description: "查看我正在追的作品（只有你看得到）", type: 1 },
        {
          name: "share",
          description: "在頻道分享你正在追的作品",
          type: 1,
          options: [
            { name: "title", description: "作品名稱（部分符合即可）", type: 3, required: true },
          ],
        },
      ],
    },
  ];
  const res = await fetch(`${DISCORD_API}/applications/${clientId}/commands`, {
    method: "PUT",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  return { ok: res.ok, status: res.status };
}
