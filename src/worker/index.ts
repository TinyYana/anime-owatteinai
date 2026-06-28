import { Hono } from "hono";
import { withDb } from "./middleware/auth";
import { applyCorsAndSecurity } from "./middleware/security";
import { authRoutes, meRoute } from "./routes/auth";
import { applicationRoutes, adminApplicationRoutes } from "./routes/application";
import { animeRoutes } from "./routes/anime";
import { myAnimeRoutes, watchSessionRoutes } from "./routes/my";
import { sourceLinkRoutes } from "./routes/sourceLinks";
import { adminPanelRoutes } from "./routes/adminPanel";
import { runGuildAudit } from "./lib/guildAudit";
import { runDailySummary } from "./lib/dailySummary";
import { discordRoutes } from "./routes/discord";
import type { AppEnv } from "./env";

const app = new Hono<AppEnv>();

// Every API request gets a DB client, CORS headers, and security headers.
app.use("/api/*", withDb, applyCorsAndSecurity);

// --- API ---
const api = new Hono<AppEnv>();
api.route("/auth", authRoutes);
api.route("/me", meRoute);
api.route("/application", applicationRoutes);
api.route("/admin/applications", adminApplicationRoutes);
api.route("/admin/panel", adminPanelRoutes);
api.route("/anime", animeRoutes);
api.route("/my/anime", myAnimeRoutes);
api.route("/my/watch-sessions", watchSessionRoutes);
api.route("/", sourceLinkRoutes); // /anime/:id/source-links, /source-links/:id
api.route("/discord", discordRoutes);

api.get("/health", (c) => c.json({ ok: true }));
api.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404));

app.route("/api", api);

// Top-level handler: catches errors from mounted sub-apps too (a sub-app's own
// onError does not fire for routes reached via app.route()).
app.onError((err, c) => {
  console.error("Worker error:", err instanceof Error ? err.stack ?? err.message : err);
  return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500);
});

// --- Static assets / SPA fallback ---
// Anything that isn't /api is served from the built Vite app. With
// not_found_handling: single-page-application, unmatched client routes
// (/app, /app/anime/:id, ...) resolve to index.html.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch.bind(app),
  // Hourly cron: audit guild membership for all active users.
  scheduled(controller: ScheduledController, env: AppEnv["Bindings"], ctx: ExecutionContext) {
    ctx.waitUntil(runGuildAudit(env));
    // ponytail: daily summary fires on the 9am cron only — guild audit runs every hour
    if (controller.cron === "0 9 * * *") {
      ctx.waitUntil(runDailySummary(env));
    }
  },
};
