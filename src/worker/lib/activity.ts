import { eq } from "drizzle-orm";
import type { DB } from "../../db/client";
import { activityEvents, users } from "../../db/schema";
import type { ActivityVisibility } from "../../shared/types";

const BLOCKED_KEYS = /secret|token|cookie|session|password|authorization/i;

function scrubMetadata(value: unknown, depth = 0): unknown {
  if (depth > 2) return null;
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => scrubMetadata(item, depth + 1));
  if (typeof value !== "object") return null;

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (BLOCKED_KEYS.test(key)) continue;
    out[key] = scrubMetadata(item, depth + 1);
  }
  return out;
}

export async function recordActivityEvent(
  db: DB,
  input: {
    actorUserId: string | null;
    eventType: string;
    targetType: string;
    targetId?: string | null;
    visibility: ActivityVisibility;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  try {
    if (input.actorUserId && input.visibility !== "system") {
      const actor = await db.query.users.findFirst({ where: eq(users.id, input.actorUserId) });
      if (!actor || actor.role === "pending" || actor.role === "banned") return;
    }

    await db.insert(activityEvents).values({
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      visibility: input.visibility,
      metadataJson: input.metadata ? (scrubMetadata(input.metadata) as Record<string, unknown>) : null,
    });
  } catch {
    // Activity is helpful history, not request-critical.
  }
}
