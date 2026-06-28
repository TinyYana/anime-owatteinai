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
  ACTIVITY_VISIBILITIES,
  ANNOUNCEMENT_LEVELS,
  ANNOUNCEMENT_AUDIENCES,
  ANIME_NOTE_TYPES,
  SPOILER_LEVELS,
  NOTE_VISIBILITIES,
} from "../shared/types";
import type { MetadataSource, NotificationType } from "../shared/types";
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
export const activityVisibilityEnum = appSchema.enum("activity_visibility", ACTIVITY_VISIBILITIES as [string, ...string[]]);
export const announcementLevelEnum = appSchema.enum("announcement_level", ANNOUNCEMENT_LEVELS as [string, ...string[]]);
export const announcementAudienceEnum = appSchema.enum("announcement_audience", ANNOUNCEMENT_AUDIENCES as [string, ...string[]]);
export const animeNoteTypeEnum = appSchema.enum("anime_note_type", ANIME_NOTE_TYPES as [string, ...string[]]);
export const spoilerLevelEnum = appSchema.enum("spoiler_level", SPOILER_LEVELS as [string, ...string[]]);
export const noteVisibilityEnum = appSchema.enum("note_visibility", NOTE_VISIBILITIES as [string, ...string[]]);

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
  dailyDmEnabled: boolean("daily_dm_enabled").notNull().default(false),
  dailyDmIncludeCommunity: boolean("daily_dm_include_community").notNull().default(true),
  dailyDmLastSentAt: timestamp("daily_dm_last_sent_at", { withTimezone: true }),
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

export const activityEvents = appSchema.table(
  "activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    visibility: activityVisibilityEnum("visibility").notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activity_events_actor_visibility_created_idx").on(t.actorUserId, t.visibility, t.createdAt),
    index("activity_events_event_type_idx").on(t.eventType),
    index("activity_events_target_idx").on(t.targetType, t.targetId),
  ],
);

export const notifications = appSchema.table(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull().$type<NotificationType>(),
    title: text("title").notNull(),
    body: text("body"),
    linkUrl: text("link_url"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    index("notifications_user_read_created_idx").on(t.userId, t.isRead, t.createdAt),
  ],
);

export const siteAnnouncements = appSchema.table(
  "site_announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    level: announcementLevelEnum("level").notNull().default("info"),
    audience: announcementAudienceEnum("audience").notNull().default("all"),
    isActive: boolean("is_active").notNull().default(true),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("site_announcements_active_audience_idx").on(t.isActive, t.audience),
    index("site_announcements_window_idx").on(t.startsAt, t.endsAt),
  ],
);

export const animeNotes = appSchema.table(
  "anime_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    animeId: uuid("anime_id").notNull().references(() => anime.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    episodeNumber: integer("episode_number"),
    type: animeNoteTypeEnum("type").notNull().default("note"),
    spoilerLevel: spoilerLevelEnum("spoiler_level").notNull().default("none"),
    visibility: noteVisibilityEnum("visibility").notNull().default("private"),
    content: text("content").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedByUserId: uuid("deleted_by_user_id").references(() => users.id, { onDelete: "set null" }),
    deleteReason: text("delete_reason"),
    ...timestamps,
  },
  (t) => [
    index("anime_notes_anime_visibility_idx").on(t.animeId, t.visibility),
    index("anime_notes_user_idx").on(t.userId),
    index("anime_notes_deleted_idx").on(t.deletedAt),
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
    reviewReason: text("review_reason"),
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
    reviewReason: text("review_reason"),
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
export type ActivityEventRow = typeof activityEvents.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type SiteAnnouncementRow = typeof siteAnnouncements.$inferSelect;
export type AnimeNoteRow = typeof animeNotes.$inferSelect;
export type AccessApplicationRow = typeof accessApplications.$inferSelect;
export type AnimeEditRequestRow = typeof animeEditRequests.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type RateLimitRow = typeof rateLimits.$inferSelect;
