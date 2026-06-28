import type { DB } from "../../db/client";
import { notifications } from "../../db/schema";
import type { NotificationType } from "../../shared/types";
import { recordActivityEvent } from "./activity";

export async function createNotification(
  db: DB,
  input: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string | null;
    linkUrl?: string | null;
  },
) {
  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      linkUrl: input.linkUrl ?? null,
    })
    .returning();
  if (row) {
    void recordActivityEvent(db, {
      actorUserId: null,
      eventType: "notification.created",
      targetType: "notification",
      targetId: row.id,
      visibility: "system",
      metadata: { userId: input.userId, type: input.type },
    });
  }
  return row;
}
