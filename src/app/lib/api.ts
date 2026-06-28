// Tiny fetch wrapper. Cookies ride along automatically (same-origin), so there
// are no tokens to manage in JS.

type ApiErrorBody = { error?: { code?: string; message?: string } | string } | null;

function extractError(body: ApiErrorBody, status: number): { code: string | null; message: string } {
  const err = body?.error ?? null;
  if (typeof err === "string") return { code: null, message: err };
  if (typeof err === "object" && err !== null) {
    return {
      code: typeof err.code === "string" ? err.code : null,
      message: typeof err.message === "string" ? err.message : `HTTP ${status}`,
    };
  }
  return { code: null, message: `HTTP ${status}` };
}

export class ApiError extends Error {
  status: number;
  code: string | null;
  body: unknown;
  constructor(status: number, body: unknown) {
    const { code, message } = extractError(body as ApiErrorBody, status);
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

/** Upgrades old AniList medium cover URLs to large as a client-side fallback. Safe on non-AniList URLs. */
export const coverUrl = (url: string | null | undefined): string | undefined =>
  url?.replace(/\/medium\//i, "/large/") ?? undefined;

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};
