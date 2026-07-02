import type { DB } from "../../db/client";
import { auditLogs } from "../../db/schema";

export type AuditAction =
  | "user.login"
  | "user.logout"
  | "application.submit"
  | "application.approve"
  | "application.reject"
  | "anime_edit.approve"
  | "anime_edit.reject"
  | "user.role_change"
  | "user.guild_revoked"
  | "user.stale_cleanup"
  | "role.permissions_change"
  | "anime.import"
  | "anime.update"
  | "anime.merge"
  | "source_link.create"
  | "source_link.delete"
  | "source_link.clear_all"
  | "alias.add"
  | "alias.delete"
  | "alias.merge";

export async function audit(
  db: DB,
  action: AuditAction,
  actorUserId: string | null,
  opts?: {
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
    ip?: string | null;
    ua?: string | null;
  },
): Promise<void> {
  try {
    const ipHash = opts?.ip ? await hashIp(opts.ip) : null;
    await db.insert(auditLogs).values({
      actorUserId: actorUserId ?? null,
      action,
      targetType: opts?.targetType ?? null,
      targetId: opts?.targetId ?? null,
      metadataJson: opts?.metadata ?? null,
      ipHash,
      userAgent: opts?.ua?.slice(0, 500) ?? null,
    });
  } catch {
    // fire-and-forget — never fail the request if audit write fails
  }
}

async function hashIp(ip: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  // First 8 bytes as hex — enough to correlate, not enough to reconstruct
  return Array.from(new Uint8Array(hash).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
