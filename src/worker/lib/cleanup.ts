import { and, eq, lt, notExists } from "drizzle-orm";
import { createDb } from "../../db/client";
import { accessApplications, userAnime, users } from "../../db/schema";
import { audit } from "./audit";
import type { Bindings } from "../env";

// 登入過但從未送出申請、也沒有任何追番資料的 pending 帳號，過了寬限期
// 就只是後台雜訊——每日 cron 直接刪掉。之後重新登入會建立全新帳號，
// 不會損失任何東西。
const GRACE_DAYS = 7;

export async function cleanupUnappliedUsers(env: Bindings): Promise<void> {
  const db = createDb(env.DATABASE_URL);
  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);

  const stale = await db
    .select({ id: users.id, discordId: users.discordId, discordUsername: users.discordUsername })
    .from(users)
    .where(
      and(
        eq(users.role, "pending"),
        eq(users.isTest, false),
        lt(users.createdAt, cutoff),
        notExists(db.select().from(accessApplications).where(eq(accessApplications.userId, users.id))),
        notExists(db.select().from(userAnime).where(eq(userAnime.userId, users.id))),
      ),
    );

  for (const user of stale) {
    await db.delete(users).where(eq(users.id, user.id));
    void audit(db, "user.stale_cleanup", null, {
      targetType: "user",
      targetId: user.id,
      metadata: { discordId: user.discordId, discordUsername: user.discordUsername },
    });
  }
}
