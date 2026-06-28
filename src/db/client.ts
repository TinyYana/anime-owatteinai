import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

export type DB = ReturnType<typeof createDb>;

// Neon's HTTP driver works on Cloudflare Workers (no TCP sockets). One client per request.
export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export { schema };
