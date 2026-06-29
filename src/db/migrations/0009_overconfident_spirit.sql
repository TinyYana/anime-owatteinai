CREATE TYPE "aon"."activity_visibility" AS ENUM('system', 'private', 'community', 'public');--> statement-breakpoint
CREATE TYPE "aon"."anime_note_type" AS ENUM('note', 'recommendation', 'episode_comment', 'question');--> statement-breakpoint
CREATE TYPE "aon"."announcement_audience" AS ENUM('all', 'member', 'admin');--> statement-breakpoint
CREATE TYPE "aon"."announcement_level" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "aon"."note_visibility" AS ENUM('private', 'community');--> statement-breakpoint
CREATE TYPE "aon"."spoiler_level" AS ENUM('none', 'minor', 'major');--> statement-breakpoint
ALTER TYPE "aon"."user_role" ADD VALUE 'moderator' BEFORE 'member';--> statement-breakpoint
CREATE TABLE "aon"."activity_events" (
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
CREATE TABLE "aon"."anime_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anime_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"episode_number" integer,
	"type" "aon"."anime_note_type" DEFAULT 'note' NOT NULL,
	"spoiler_level" "aon"."spoiler_level" DEFAULT 'none' NOT NULL,
	"visibility" "aon"."note_visibility" DEFAULT 'private' NOT NULL,
	"content" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aon"."audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata_json" jsonb,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aon"."notifications" (
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
CREATE TABLE "aon"."rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aon"."role_permissions" (
	"role" text NOT NULL,
	"permission" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_permission_unique" UNIQUE("role","permission")
);
--> statement-breakpoint
CREATE TABLE "aon"."site_announcements" (
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
ALTER TABLE "aon"."access_applications" ADD COLUMN "review_reason" text;--> statement-breakpoint
ALTER TABLE "aon"."anime_edit_requests" ADD COLUMN "review_reason" text;--> statement-breakpoint
ALTER TABLE "aon"."user_anime" ADD COLUMN "sort_order" integer;--> statement-breakpoint
ALTER TABLE "aon"."users" ADD COLUMN "is_test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "aon"."users" ADD COLUMN "daily_dm_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "aon"."users" ADD COLUMN "daily_dm_include_community" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "aon"."users" ADD COLUMN "daily_dm_last_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "aon"."activity_events" ADD CONSTRAINT "activity_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "aon"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aon"."anime_notes" ADD CONSTRAINT "anime_notes_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "aon"."anime"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aon"."anime_notes" ADD CONSTRAINT "anime_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "aon"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aon"."anime_notes" ADD CONSTRAINT "anime_notes_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "aon"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aon"."audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "aon"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aon"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "aon"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aon"."site_announcements" ADD CONSTRAINT "site_announcements_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "aon"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_events_actor_visibility_created_idx" ON "aon"."activity_events" USING btree ("actor_user_id","visibility","created_at");--> statement-breakpoint
CREATE INDEX "activity_events_event_type_idx" ON "aon"."activity_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "activity_events_target_idx" ON "aon"."activity_events" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "anime_notes_anime_visibility_idx" ON "aon"."anime_notes" USING btree ("anime_id","visibility");--> statement-breakpoint
CREATE INDEX "anime_notes_user_idx" ON "aon"."anime_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "anime_notes_deleted_idx" ON "aon"."anime_notes" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "aon"."audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "aon"."audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "aon"."audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_read_created_idx" ON "aon"."notifications" USING btree ("user_id","is_read","created_at");--> statement-breakpoint
CREATE INDEX "role_permissions_role_idx" ON "aon"."role_permissions" USING btree ("role");--> statement-breakpoint
CREATE INDEX "site_announcements_active_audience_idx" ON "aon"."site_announcements" USING btree ("is_active","audience");--> statement-breakpoint
CREATE INDEX "site_announcements_window_idx" ON "aon"."site_announcements" USING btree ("starts_at","ends_at");