import {
  pgSchema,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  real,
  unique,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import {
  USER_ROLES,
  WATCH_STATUSES,
  SOURCE_TYPES,
  ANIME_PRIORITIES,
  APPLICATION_STATUSES,
} from "../shared/types";
import type { MetadataSource } from "../shared/types";
import type { RolePermission } from "../shared/types";

// All objects live in a dedicated schema owned by the app's DB role, so the
// least-privilege connection role doesn't need CREATE on `public`.
export const appSchema = pgSchema("aon");

// pgEnums mirror the shared string-literal unions.
export const userRoleEnum = appSchema.enum("user_role", USER_ROLES as [string, ...string[]]);
export const watchStatusEnum = appSchema.enum("watch_status", WATCH_STATUSES as [string, ...string[]]);
export const sourceTypeEnum = appSchema.enum("source_type", SOURCE_TYPES as [string, ...string[]]);
export const animePriorityEnum = appSchema.enum("anime_priority", ANIME_PRIORITIES as [string, ...string[]]);
export const applicationStatusEnum = appSchema.enum("application_status", APPLICATION_STATUSES as [string, ...string[]]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = appSchema.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  discordId: text("discord_id").notNull().unique(),
  discordUsername: text("discord_username").notNull(),
  discordGlobalName: text("discord_global_name"),
  discordAvatar: text("discord_avatar"),
  role: userRoleEnum("role").notNull().default("pending"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  isTest: boolean("is_test").notNull().default(false),
  ...timestamps,
});

export const rolePermissions = appSchema.table(
  "role_permissions",
  {
    role: text("role").notNull().$type<typeof USER_ROLES[number]>(),
    permission: text("permission").notNull().$type<RolePermission>(),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("role_permissions_role_permission_unique").on(t.role, t.permission),
    index("role_permissions_role_idx").on(t.role),
  ],
);

export const anime = appSchema.table(
  "anime",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    titleZh: text("title_zh"),
    titleJp: text("title_jp"),
    // External metadata fields — populated on import, user can override via PATCH
    titleRomaji: text("title_romaji"),
    titleEnglish: text("title_english"),
    titleNative: text("title_native"),
    synonyms: jsonb("synonyms").$type<string[]>(),
    externalAnilistId: integer("external_anilist_id"),
    externalMalId: integer("external_mal_id"),
    externalBangumiId: integer("external_bangumi_id"),
    format: text("format"),
    statusExternal: text("status_external"),
    season: text("season"),
    seasonYear: integer("season_year"),
    episodesTotal: integer("episodes_total"),
    coverImageUrl: text("cover_image_url"),
    metadataSource: text("metadata_source").$type<MetadataSource>(),
    metadataLocked: boolean("metadata_locked").notNull().default(false),
    metadataFetchedAt: timestamp("metadata_fetched_at", { withTimezone: true }),
    description: text("description"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    // Fast dedup lookup on import
    index("anime_anilist_idx").on(t.externalAnilistId),
  ],
);

export const userAnime = appSchema.table(
  "user_anime",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    animeId: uuid("anime_id").notNull().references(() => anime.id, { onDelete: "cascade" }),
    status: watchStatusEnum("status").notNull().default("planned"),
    currentEpisode: integer("current_episode").notNull().default(0),
    priority: animePriorityEnum("priority").notNull().default("normal"),
    isPublic: boolean("is_public").notNull().default(false),
    privateNote: text("private_note"),
    ...timestamps,
  },
  (t) => [
    // One tracking row per (user, anime).
    unique("user_anime_user_anime_unique").on(t.userId, t.animeId),
    index("user_anime_user_idx").on(t.userId),
  ],
);

export const sourceLinks = appSchema.table(
  "source_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    animeId: uuid("anime_id").notNull().references(() => anime.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    type: sourceTypeEnum("type").notNull().default("manual"),
    label: text("label").notNull(),
    url: text("url").notNull(),
    ...timestamps,
  },
  (t) => [
    index("source_links_anime_idx").on(t.animeId),
  ],
);

export const watchSessions = appSchema.table(
  "watch_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    animeId: uuid("anime_id").notNull().references(() => anime.id, { onDelete: "cascade" }),
    episodeNumber: integer("episode_number").notNull(),
    sourceLinkId: uuid("source_link_id").references(() => sourceLinks.id, { onDelete: "set null" }),
    watchedAt: timestamp("watched_at", { withTimezone: true }).notNull().defaultNow(),
    progress: real("progress"),
    completed: boolean("completed").notNull().default(false),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("watch_sessions_user_idx").on(t.userId),
    index("watch_sessions_user_anime_idx").on(t.userId, t.animeId),
  ],
);

export const accessApplications = appSchema.table(
  "access_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: applicationStatusEnum("status").notNull().default("pending"),
    message: text("message"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("access_applications_user_idx").on(t.userId),
    index("access_applications_status_idx").on(t.status),
  ],
);

export const animeEditRequests = appSchema.table(
  "anime_edit_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    animeId: uuid("anime_id").notNull().references(() => anime.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: applicationStatusEnum("status").notNull().default("pending"),
    payload: jsonb("payload").$type<{
      title?: string;
      titleZh?: string | null;
      titleJp?: string | null;
      description?: string | null;
      coverImageUrl?: string | null;
      episodesTotal?: number | null;
    }>().notNull(),
    note: text("note"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("anime_edit_requests_anime_idx").on(t.animeId),
    index("anime_edit_requests_status_idx").on(t.status),
  ],
);

export const auditLogs = appSchema.table(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadataJson: jsonb("metadata_json"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_actor_idx").on(t.actorUserId),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_created_idx").on(t.createdAt),
  ],
);

export const rateLimits = appSchema.table("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type RolePermissionRow = typeof rolePermissions.$inferSelect;
export type AnimeRow = typeof anime.$inferSelect;
export type UserAnimeRow = typeof userAnime.$inferSelect;
export type SourceLinkRow = typeof sourceLinks.$inferSelect;
export type WatchSessionRow = typeof watchSessions.$inferSelect;
export type AccessApplicationRow = typeof accessApplications.$inferSelect;
export type AnimeEditRequestRow = typeof animeEditRequests.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type RateLimitRow = typeof rateLimits.$inferSelect;
