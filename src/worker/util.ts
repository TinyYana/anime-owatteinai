import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ZodSchema } from "zod";
import type { AppEnv } from "./env";

/** Standardised error response shape: {error: {code, message}}. Never includes stack traces. */
export function apiError(
  c: Context<AppEnv>,
  status: ContentfulStatusCode,
  code: string,
  message: string,
): Response {
  return c.json({ error: { code, message } }, status);
}

/**
 * Parse + validate a JSON body. Returns the typed value, or a Response (400)
 * the caller should return directly:
 *
 *   const body = await parseBody(c, schema);
 *   if (body instanceof Response) return body;
 */
export async function parseBody<T>(
  c: Context<AppEnv>,
  schema: ZodSchema<T>,
): Promise<T | Response> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: { code: "INVALID_JSON", message: "Invalid JSON" } }, 400);
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return c.json(
      { error: { code: "VALIDATION_FAILED", message: "Validation failed", issues: result.error.flatten() } },
      400,
    );
  }
  return result.data;
}
