import { z } from "zod";
import {
  WATCH_STATUSES,
  SOURCE_TYPES,
  ANIME_PRIORITIES,
  METADATA_SOURCES,
  NOTIFICATION_TYPES,
  ANNOUNCEMENT_LEVELS,
  ANNOUNCEMENT_AUDIENCES,
  ANIME_NOTE_TYPES,
  SPOILER_LEVELS,
  NOTE_VISIBILITIES,
} from "./types";

// Zod schemas for every write endpoint. The Worker validates all input through
// these before touching the database.

const nonEmpty = (max: number) => z.string().trim().min(1).max(max);

export const watchStatusSchema = z.enum(WATCH_STATUSES as [string, ...string[]]);
export const sourceTypeSchema = z.enum(SOURCE_TYPES as [string, ...string[]]);
export const animePrioritySchema = z.enum(ANIME_PRIORITIES as [string, ...string[]]);
export const metadataSourceSchema = z.enum(METADATA_SOURCES as [string, ...string[]]);
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES as [string, ...string[]]);
export const announcementLevelSchema = z.enum(ANNOUNCEMENT_LEVELS as [string, ...string[]]);
export const announcementAudienceSchema = z.enum(ANNOUNCEMENT_AUDIENCES as [string, ...string[]]);
export const animeNoteTypeSchema = z.enum(ANIME_NOTE_TYPES as [string, ...string[]]);
export const spoilerLevelSchema = z.enum(SPOILER_LEVELS as [string, ...string[]]);
export const noteVisibilitySchema = z.enum(NOTE_VISIBILITIES as [string, ...string[]]);

const optionalDateString = z
  .string()
  .trim()
  .datetime({ offset: true })
  .optional()
  .nullable();

export const linkUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    if (value.startsWith("/")) return !value.startsWith("//");
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "Invalid link URL");

// --- Anime ---
export const createAnimeSchema = z.object({
  title: nonEmpty(300),
  titleZh: nonEmpty(300).optional().nullable(),
  titleJp: nonEmpty(300).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
});

export const updateAnimeSchema = createAnimeSchema.partial();

export const animeEditPayloadSchema = z
  .object({
    title: nonEmpty(300).optional(),
    titleZh: nonEmpty(300).optional().nullable(),
    titleJp: nonEmpty(300).optional().nullable(),
    description: z.string().trim().max(5000).optional().nullable(),
    coverImageUrl: z.string().trim().url().max(2000).optional().nullable(),
    episodesTotal: z.number().int().min(0).max(9999).optional().nullable(),
  })
  .refine((v) => Object.values(v).some((x) => x !== null && x !== undefined), { message: "No fields to update" });

export const createAnimeEditRequestSchema = z.object({
  payload: animeEditPayloadSchema,
  note: z.string().trim().max(1000).optional().nullable(),
});

export const reviewAnimeEditRequestSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewReason: z.string().trim().max(1000).optional().nullable(),
});

export const reviewApplicationSchema = z.object({
  reviewReason: z.string().trim().max(1000).optional().nullable(),
});

// --- My anime (user_anime) ---
export const addMyAnimeSchema = z.object({
  animeId: z.string().uuid(),
  status: watchStatusSchema.default("planned"),
  currentEpisode: z.number().int().min(0).default(0),
  priority: animePrioritySchema.default("normal"),
  isPublic: z.boolean().default(false),
  privateNote: z.string().trim().max(2000).optional().nullable(),
});

export const updateMyAnimeSchema = z
  .object({
    status: watchStatusSchema,
    currentEpisode: z.number().int().min(0),
    priority: animePrioritySchema,
    isPublic: z.boolean(),
    privateNote: z.string().trim().max(2000).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export const reorderMyAnimeSchema = z.object({
  orders: z.array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0) })).min(1),
});

// --- Source links ---
export const createSourceLinkSchema = z.object({
  type: sourceTypeSchema,
  label: nonEmpty(200),
  // Only http(s) URLs are stored. We never fetch the content behind them.
  url: z.string().trim().url().max(2000).refine((u) => /^https?:\/\//i.test(u), {
    message: "URL must be http(s)",
  }),
});

// --- Watch sessions ---
export const createWatchSessionSchema = z.object({
  animeId: z.string().uuid(),
  episodeNumber: z.number().int().positive(),
  sourceLinkId: z.string().uuid().optional().nullable(),
  sourceUrl: z.string().trim().url().max(2000).optional().nullable(),
  sourceLabel: z.string().trim().max(200).optional().nullable(),
  priority: animePrioritySchema.optional(),
  progress: z.number().min(0).max(100).optional().nullable(),
  completed: z.boolean().default(false),
  note: z.string().trim().max(2000).optional().nullable(),
});

// --- Applications ---
export const createApplicationSchema = z.object({
  message: z.string().trim().max(1000).optional().nullable(),
});

// --- Notification settings ---
export const updateNotificationSettingsSchema = z
  .object({
    dailyDmEnabled: z.boolean(),
    dailyDmIncludeCommunity: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: notificationTypeSchema.default("system"),
  title: nonEmpty(120),
  body: z.string().trim().max(1000).optional().nullable(),
  linkUrl: linkUrlSchema.optional().nullable(),
});

export const createAnnouncementSchema = z.object({
  title: nonEmpty(120),
  content: nonEmpty(2000),
  level: announcementLevelSchema.default("info"),
  audience: announcementAudienceSchema.default("all"),
  isActive: z.boolean().default(true),
  startsAt: optionalDateString,
  endsAt: optionalDateString,
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "No fields to update" },
);

export const createAnimeNoteSchema = z.object({
  episodeNumber: z.number().int().positive().optional().nullable(),
  type: animeNoteTypeSchema.default("note"),
  spoilerLevel: spoilerLevelSchema,
  visibility: noteVisibilitySchema.default("private"),
  content: nonEmpty(2000),
});

export const updateAnimeNoteSchema = createAnimeNoteSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: "No fields to update" },
);

export const deleteAnimeNoteSchema = z.object({
  deleteReason: z.string().trim().max(1000).optional().nullable(),
});

// --- Anime import (from external search) ---
export const importAnimeSchema = z.object({
  externalAnilistId: z.number().int().positive().optional(),
  externalMalId: z.number().int().positive().optional().nullable(),
  externalBangumiId: z.number().int().positive().optional().nullable(),
  title: nonEmpty(300),
  titleRomaji: nonEmpty(300).optional().nullable(),
  titleEnglish: nonEmpty(300).optional().nullable(),
  titleNative: nonEmpty(300).optional().nullable(),
  titleZh: nonEmpty(300).optional().nullable(),
  titleJp: nonEmpty(300).optional().nullable(),
  observedTitle: nonEmpty(300).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  synonyms: z.array(z.string().max(300)).max(50).optional().nullable(),
  format: z.string().max(50).optional().nullable(),
  statusExternal: z.string().max(50).optional().nullable(),
  season: z.string().max(20).optional().nullable(),
  seasonYear: z.number().int().min(1900).max(2100).optional().nullable(),
  episodesTotal: z.number().int().min(0).max(9999).optional().nullable(),
  coverImageUrl: z.string().url().max(2000).optional().nullable(),
  metadataSource: metadataSourceSchema.optional(),
  addToList: z.boolean().default(true),
});

export type CreateAnimeInput = z.infer<typeof createAnimeSchema>;
export type UpdateAnimeInput = z.infer<typeof updateAnimeSchema>;
export type CreateAnimeEditRequestInput = z.infer<typeof createAnimeEditRequestSchema>;
export type ImportAnimeInput = z.infer<typeof importAnimeSchema>;
export type AddMyAnimeInput = z.infer<typeof addMyAnimeSchema>;
export type UpdateMyAnimeInput = z.infer<typeof updateMyAnimeSchema>;
export type ReorderMyAnimeInput = z.infer<typeof reorderMyAnimeSchema>;
export type CreateSourceLinkInput = z.infer<typeof createSourceLinkSchema>;
export type CreateWatchSessionInput = z.infer<typeof createWatchSessionSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateNotificationSettingsInput = z.infer<typeof updateNotificationSettingsSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type CreateAnimeNoteInput = z.infer<typeof createAnimeNoteSchema>;
export type UpdateAnimeNoteInput = z.infer<typeof updateAnimeNoteSchema>;
export type DeleteAnimeNoteInput = z.infer<typeof deleteAnimeNoteSchema>;

// --- Safe external URL validation ---
// Used wherever we accept a user-supplied URL that will only be stored (never fetched).
const BLOCKED_SCHEMES = /^(javascript:|data:|file:|chrome-extension:|chrome:|vbscript:|about:)/i;

export function validateSafeExternalUrl(
  raw: string,
): { ok: true; url: string } | { ok: false; error: string } {
  if (raw.length > 2000) return { ok: false, error: "URL too long" };
  if (BLOCKED_SCHEMES.test(raw.trim())) return { ok: false, error: "URL scheme not allowed" };
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "URL must use http or https" };
    }
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false, error: "Invalid URL" };
  }
}
