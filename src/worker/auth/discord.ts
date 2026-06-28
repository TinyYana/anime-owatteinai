// Thin Discord OAuth2 helpers. Scope is "identify" only — we never request
// guild data, email, or anything beyond the basic profile.

const DISCORD_API = "https://discord.com/api";

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const u = new URL(`${DISCORD_API}/oauth2/authorize`);
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "identify");
  u.searchParams.set("state", params.state);
  u.searchParams.set("prompt", "consent");
  return u.toString();
}

export async function exchangeCode(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<string> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
  });
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Discord token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Discord token exchange returned no access_token");
  return json.access_token;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Discord /users/@me failed: ${res.status}`);
  }
  return (await res.json()) as DiscordUser;
}

/**
 * Check whether a Discord user is a member of a guild.
 * Uses a bot token (requires bot to be in the guild).
 * Returns false on 404 (not a member). Throws on auth/rate-limit errors.
 */
export async function checkGuildMembership(botToken: string, guildId: string, userId: string): Promise<boolean> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (res.status === 200) return true;
  if (res.status === 404) return false;
  throw new Error(`Guild membership check failed: ${res.status}`);
}
