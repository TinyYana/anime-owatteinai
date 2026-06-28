// Stateless, signed session cookies (HMAC-SHA256). No session table needed:
// the cookie carries only the user id + expiry, and every request re-loads the
// user from the DB (so role changes and bans take effect immediately).

const SESSION_COOKIE = "aon_session";
const STATE_COOKIE = "aon_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return base64url(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

function isSecure(appBaseUrl: string): boolean {
  return appBaseUrl.startsWith("https://");
}

function buildCookie(
  name: string,
  value: string,
  opts: { maxAge?: number; secure: boolean },
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (opts.secure) parts.push("Secure");
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  return parts.join("; ");
}

// --- Session ---

export async function createSessionCookie(
  secret: string,
  appBaseUrl: string,
  userId: string,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = base64url(encoder.encode(JSON.stringify({ uid: userId, exp })));
  const sig = await hmac(secret, payload);
  return buildCookie(SESSION_COOKIE, `${payload}.${sig}`, {
    maxAge: SESSION_TTL_SECONDS,
    secure: isSecure(appBaseUrl),
  });
}

export function clearSessionCookie(appBaseUrl: string): string {
  return buildCookie(SESSION_COOKIE, "", { maxAge: 0, secure: isSecure(appBaseUrl) });
}

export async function readSession(
  secret: string,
  cookieHeader: string | null,
): Promise<{ userId: string } | null> {
  const token = parseCookies(cookieHeader)[SESSION_COOKIE];
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(secret, payload);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromBase64url(payload))) as {
      uid: string;
      exp: number;
    };
    if (!data.uid || typeof data.exp !== "number") return null;
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: data.uid };
  } catch {
    return null;
  }
}

// --- OAuth state (CSRF protection) ---

export function createStateCookie(appBaseUrl: string, state: string): string {
  // Short-lived; cleared by callback.
  return buildCookie(STATE_COOKIE, state, { maxAge: 600, secure: isSecure(appBaseUrl) });
}

export function clearStateCookie(appBaseUrl: string): string {
  return buildCookie(STATE_COOKIE, "", { maxAge: 0, secure: isSecure(appBaseUrl) });
}

export function readState(cookieHeader: string | null): string | null {
  return parseCookies(cookieHeader)[STATE_COOKIE] ?? null;
}

export function randomState(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(24)));
}
