CREATE TYPE "aon"."activity_visibility" AS ENUM('system', 'private', 'community', 'public');--> statement-breakpoint
CREATE TYPE "aon"."announcement_audience" AS ENUM('all', 'member', 'admin');--> statement-breakpoint
CREATE TYPE "aon"."announcement_level" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "aon"."anime_note_type" AS ENUM('note', 'recommendation', 'episode_comment', 'question');--> statement-breakpoint
CREATE TYPE "aon"."note_visibility" AS ENUM('private', 'community');--> statement-breakpoint
CREATE TYPE "aon"."spoiler_level" AS ENUM('none', 'minor', 'major');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aon"."activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"event_type" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"visibility" "aon"."activity_visibility" NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aon"."anime_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anime_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"episode_number" integer,
	"type" "aon"."anime_note_type" DEFAULT 'note' NOT NULL,
	"spoiler_level" "aon"."spoiler_level" DEFAULT 'none' NOT NULL,
	"visibility" "aon"."note_visibility" DEFAULT 'private' NOT NULL,
	"content" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aon"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link_url" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aon"."site_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"level" "aon"."announcement_level" DEFAULT 'info' NOT NULL,
	"audience" "aon"."announcement_audience" DEFAULT 'all' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aon"."activity_events" ADD CONSTRAINT "activity_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "aon"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aon"."anime_notes" ADD CONSTRAINT "anime_notes_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "aon"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aon"."anime_notes" ADD CONSTRAINT "anime_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "aon"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aon"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "aon"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aon"."site_announcements" ADD CONSTRAINT "site_announcements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "aon"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_events_actor_visibility_created_idx" ON "aon"."activity_events" USING btree ("actor_user_id","visibility","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_events_event_type_idx" ON "aon"."activity_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_events_target_idx" ON "aon"."activity_events" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anime_notes_anime_visibility_idx" ON "aon"."anime_notes" USING btree ("anime_id","visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anime_notes_deleted_idx" ON "aon"."anime_notes" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anime_notes_user_idx" ON "aon"."anime_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_read_created_idx" ON "aon"."notifications" USING btree ("user_id","is_read","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_announcements_active_audience_idx" ON "aon"."site_announcements" USING btree ("is_active","audience");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_announcements_window_idx" ON "aon"."site_announcements" USING btree ("starts_at","ends_at");
