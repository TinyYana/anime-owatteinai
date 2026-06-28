import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";

/**
 * CORS + security headers middleware applied to all /api/* routes.
 *
 * Dev mode (APP_BASE_URL contains localhost / 127.0.0.1):
 *   - CORS echoes the request Origin back so the browser extension and Vite dev
 *     server can reach the API without being blocked.
 *
 * Production:
 *   - CORS is locked to APP_BASE_URL (same-origin SPA, no extension needed).
 *   - CSP is applied.
 */
export const applyCorsAndSecurity = createMiddleware<AppEnv>(async (c, next) => {
  const isDev =
    c.env.APP_BASE_URL.includes("localhost") || c.env.APP_BASE_URL.includes("127.0.0.1");
  const reqOrigin = c.req.header("Origin");

  // OPTIONS preflight — respond immediately with CORS headers.
  if (c.req.method === "OPTIONS") {
    const allowOrigin = isDev ? (reqOrigin ?? c.env.APP_BASE_URL) : c.env.APP_BASE_URL;
    return new Response(null, {
      status: 204,
      headers: new Headers({
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Cookie",
        "Access-Control-Max-Age": "86400",
      }),
    });
  }

  await next();

  // CORS response headers
  if (reqOrigin) {
    const allowOrigin = isDev ? reqOrigin : c.env.APP_BASE_URL;
    c.header("Access-Control-Allow-Origin", allowOrigin);
    c.header("Access-Control-Allow-Credentials", "true");
  }

  // Security headers on every response
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  if (!isDev) {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    // ponytail: unsafe-inline for Tailwind v4 (uses style attributes); tighten when migrated off
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'",
    );
  }
});
