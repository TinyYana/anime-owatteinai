ALTER TABLE "aon"."anime" ADD COLUMN "title_romaji" text;--> statement-breakpoint
ALTER TABLE "aon"."anime" ADD COLUMN "title_english" text;--> statement-breakpoint
ALTER TABLE "aon"."anime" ADD COLUMN "title_native" text;--> statement-breakpoint
ALTER TABLE "aon"."anime" ADD COLUMN "synonyms" jsonb;--> statement-breakpoint
ALTER TABLE "aon"."anime" ADD COLUMN "external_anilist_id" integer;--> statement-breakpoint
ALTER TABLE "aon"."anime" ADD COLUMN "external_mal_id" integer;--> statement-breakpoint
ALTER TABLE "aon"."anime" ADD COLUMN "external_bangumi_id" integer;--> statement-breakpoint
ALTER TABLE "aon"."anime" ADD COLUMN "format" text;--> statement-breakpoint
ALTER TABLE "aon"."anime" ADD COLUMN "status_external" text;--> statement-breakpoint
ALTER TABLE "aon"."anime" ADD COLUMN "season" text;--> statement-breakpoint
ALTER TABLE "aon"."anime" ADD COLUMN "season_year" integer;--> statement-breakpoint
ALTER TABLE "aon"."anime" ADD COLUMN "episodes_total" integer;--> statement-breakpoint
ALTER TABLE "aon"."anime" ADD COLUMN "cover_image_url" text;--> statement-breakpoint
ALTER TABLE "aon"."anime" ADD COLUMN "metadata_source" text;--> statement-breakpoint
ALTER TABLE "aon"."anime" ADD COLUMN "metadata_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "aon"."anime" ADD COLUMN "metadata_fetched_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anime_anilist_idx" ON "aon"."anime" USING btree ("external_anilist_id");