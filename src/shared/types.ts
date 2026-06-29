// Domain enums shared between the Worker and the React app.
// These string-literal unions are the single source of truth; the Drizzle
// pgEnums and Zod validators mirror them.

export type UserRole = "owner" | "admin" | "moderator" | "member" | "pending" | "banned";
export type RolePermission =
  | "app.access"
  | "admin.access"
  | "applications.review"
  | "users.manage"
  | "roles.manage"
  | "anime.manage"
  | "audit.view";

export type WatchStatus = "watching" | "planned" | "paused" | "completed" | "dropped";

export type SourceType = "official" | "community_link" | "search_link" | "manual";

export type AnimePriority = "high" | "normal" | "low";

export type ApplicationStatus = "pending" | "approved" | "rejected";

export type MetadataSource = "manual" | "anilist" | "bangumi" | "jikan";
export type ActivityVisibility = "system" | "private" | "community" | "public";
export type NotificationType =
  | "application_approved"
  | "application_rejected"
  | "announcement"
  | "admin_notice"
  | "anime_merged"
  | "alias_removed"
  | "note_removed"
  | "system";
export type AnnouncementLevel = "info" | "warning" | "critical";
export type AnnouncementAudience = "all" | "member" | "admin";
export type AnimeNoteType = "note" | "recommendation" | "episode_comment" | "question";
export type SpoilerLevel = "none" | "minor" | "major";
export type NoteVisibility = "private" | "community";

export const USER_ROLES: readonly UserRole[] = ["owner", "admin", "moderator", "member", "pending", "banned"];
export const ROLE_PERMISSIONS: readonly RolePermission[] = [
  "app.access",
  "admin.access",
  "applications.review",
  "users.manage",
  "roles.manage",
  "anime.manage",
  "audit.view",
];
export const WATCH_STATUSES: readonly WatchStatus[] = ["watching", "planned", "paused", "completed", "dropped"];
export const SOURCE_TYPES: readonly SourceType[] = ["official", "community_link", "search_link", "manual"];
export const ANIME_PRIORITIES: readonly AnimePriority[] = ["high", "normal", "low"];
export const APPLICATION_STATUSES: readonly ApplicationStatus[] = ["pending", "approved", "rejected"];
export const METADATA_SOURCES: readonly MetadataSource[] = ["manual", "anilist", "bangumi", "jikan"];
export const ACTIVITY_VISIBILITIES: readonly ActivityVisibility[] = ["system", "private", "community", "public"];
export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "application_approved",
  "application_rejected",
  "announcement",
  "admin_notice",
  "anime_merged",
  "alias_removed",
  "note_removed",
  "system",
];
export const ANNOUNCEMENT_LEVELS: readonly AnnouncementLevel[] = ["info", "warning", "critical"];
export const ANNOUNCEMENT_AUDIENCES: readonly AnnouncementAudience[] = ["all", "member", "admin"];
export const ANIME_NOTE_TYPES: readonly AnimeNoteType[] = ["note", "recommendation", "episode_comment", "question"];
export const SPOILER_LEVELS: readonly SpoilerLevel[] = ["none", "minor", "major"];
export const NOTE_VISIBILITIES: readonly NoteVisibility[] = ["private", "community"];

export const ROLE_PERMISSION_LABELS: Record<RolePermission, string> = {
  "app.access": "進入 App",
  "admin.access": "進入管理介面",
  "applications.review": "審核加入申請",
  "users.manage": "管理使用者身份",
  "roles.manage": "編輯身份權限",
  "anime.manage": "管理動畫資料",
  "audit.view": "查看審計紀錄",
};

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, readonly RolePermission[]> = {
  owner: ROLE_PERMISSIONS,
  admin: ["app.access", "admin.access", "applications.review", "users.manage", "roles.manage", "anime.manage", "audit.view"],
  moderator: ["app.access", "admin.access", "applications.review", "anime.manage", "audit.view"],
  member: ["app.access"],
  pending: [],
  banned: [],
};

// --- API DTOs (what the frontend receives) ---

export interface MeResponse {
  id: string;
  discordId: string;
  discordUsername: string;
  discordGlobalName: string | null;
  discordAvatar: string | null;
  role: UserRole;
  permissions: RolePermission[];
  lastLoginAt: string | null;
}

export interface NotificationSettings {
  dailyDmEnabled: boolean;
  dailyDmIncludeCommunity: boolean;
  dailyDmLastSentAt: string | null;
}

export interface Anime {
  id: string;
  // canonical / user-editable titles
  title: string;
  titleZh: string | null;
  titleJp: string | null;
  // external metadata (from AniList / Bangumi / Jikan)
  titleRomaji: string | null;
  titleEnglish: string | null;
  titleNative: string | null;
  synonyms: string[] | null;
  externalAnilistId: number | null;
  externalMalId: number | null;
  externalBangumiId: number | null;
  format: string | null;
  statusExternal: string | null;
  season: string | null;
  seasonYear: number | null;
  episodesTotal: number | null;
  coverImageUrl: string | null;
  metadataSource: MetadataSource | null;
  metadataLocked: boolean;
  metadataFetchedAt: string | null;
  description: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A candidate returned by the external search endpoint before the user confirms import. */
export interface AnimeSearchCandidate {
  externalAnilistId?: number;
  externalMalId?: number;
  externalBangumiId?: number;
  title: string;
  titleRomaji?: string;
  titleEnglish?: string;
  titleNative?: string;
  titleZh?: string;
  synonyms?: string[];
  episodes?: number;
  season?: string;
  seasonYear?: number;
  format?: string;
  statusExternal?: string;
  coverImageUrl?: string;
  description?: string;
  source: "anilist" | "bangumi" | "jikan";
}

export interface AnimeSearchResult {
  local: Anime[];
  external: AnimeSearchCandidate[];
}

export interface UserAnime {
  id: string;
  userId: string;
  animeId: string;
  status: WatchStatus;
  currentEpisode: number;
  priority: AnimePriority;
  isPublic: boolean;
  privateNote: string | null;
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

/** A user_anime row joined with its anime for list/dashboard rendering. */
export interface UserAnimeWithAnime extends UserAnime {
  anime: Anime;
}

export interface SourceLink {
  id: string;
  animeId: string;
  userId: string | null;
  userName: string | null;
  userUsername: string | null;
  type: SourceType;
  label: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface WatchSession {
  id: string;
  userId: string;
  animeId: string;
  episodeNumber: number;
  sourceLinkId: string | null;
  watchedAt: string;
  progress: number | null;
  completed: boolean;
  note: string | null;
  createdAt: string;
}

export interface AccessApplication {
  id: string;
  userId: string;
  status: ApplicationStatus;
  message: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Application joined with the applicant's basic info, for the admin review list. */
export interface AccessApplicationWithUser extends AccessApplication {
  user: Pick<MeResponse, "id" | "discordId" | "discordUsername" | "discordGlobalName" | "discordAvatar" | "role">;
}

export interface AccessApplicationReviewRecord extends AccessApplicationWithUser {
  reviewer: Pick<MeResponse, "id" | "discordUsername" | "discordGlobalName"> | null;
}

export interface AnimeEditRequest {
  id: string;
  animeId: string;
  userId: string;
  status: ApplicationStatus;
  payload: Partial<Pick<Anime, "title" | "titleZh" | "titleJp" | "description" | "coverImageUrl" | "episodesTotal">>;
  note: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewReason: string | null;
  createdAt: string;
  updatedAt: string;
  animeTitle: string | null;
  animeTitleFallback: string;
  userName: string | null;
  userUsername: string | null;
  reviewerName: string | null;
  reviewerUsername: string | null;
}

export interface RolePermissionConfig {
  role: UserRole;
  permissions: RolePermission[];
}

export interface ActivityEvent {
  id: string;
  actorUserId: string | null;
  eventType: string;
  targetType: string;
  targetId: string | null;
  visibility: ActivityVisibility;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface SiteAnnouncement {
  id: string;
  title: string;
  content: string;
  level: AnnouncementLevel;
  audience: AnnouncementAudience;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnimeNote {
  id: string;
  animeId: string;
  userId: string;
  episodeNumber: number | null;
  type: AnimeNoteType;
  spoilerLevel: SpoilerLevel;
  visibility: NoteVisibility;
  content: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedByUserId: string | null;
  deleteReason: string | null;
  userName?: string | null;
}

export interface CommunitySummaryItem {
  animeId: string;
  title: string;
  titleZh: string | null;
  watchingCount: number;
  recentProgressCount: number;
  noteCount: number;
}

export interface CommunitySummary {
  trendingAnime: CommunitySummaryItem[];
}
