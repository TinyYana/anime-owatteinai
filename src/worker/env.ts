import type { DB } from "../db/client";
import type { UserRow } from "../db/schema";

// Bindings configured in wrangler.jsonc (vars) and .dev.vars / `wrangler secret` (secrets).
export interface Bindings {
  ASSETS: Fetcher;
  DATABASE_URL: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_REDIRECT_URI: string;
  SESSION_SECRET: string;
  ADMIN_DISCORD_IDS: string;
  APP_BASE_URL: string;
  // KV namespace for caching external metadata API responses.
  // Create with: wrangler kv namespace create METADATA_CACHE
  METADATA_CACHE: KVNamespace;
  // Guild gate — both must be non-empty to enable membership checks.
  // DISCORD_GUILD_ID: non-secret, in wrangler.jsonc vars.
  // DISCORD_BOT_TOKEN: secret, in .dev.vars / wrangler secret.
  DISCORD_GUILD_ID: string;
  DISCORD_BOT_TOKEN: string;
  // Interactions endpoint signature verification (Discord Developer Portal → General → Public Key)
  DISCORD_PUBLIC_KEY: string;
  // Channel ID for daily community summary posts (non-secret, in wrangler.jsonc vars)
  DISCORD_NOTIFICATION_CHANNEL_ID: string;
}

// Per-request values populated by middleware.
export interface Variables {
  db: DB;
  user: UserRow;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
