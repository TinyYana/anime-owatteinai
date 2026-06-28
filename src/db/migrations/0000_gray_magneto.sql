CREATE SCHEMA "aon";
--> statement-breakpoint
CREATE TYPE "aon"."anime_priority" AS ENUM('high', 'normal', 'low');--> statement-breakpoint
CREATE TYPE "aon"."application_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "aon"."source_type" AS ENUM('official', 'community_link', 'search_link', 'manual');--> statement-breakpoint
CREATE TYPE "aon"."user_role" AS ENUM('owner', 'admin', 'member', 'pending', 'banned');--> statement-breakpoint
CREATE TYPE "aon"."watch_status" AS ENUM('watching', 'planned', 'paused', 'completed', 'dropped');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aon"."access_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "aon"."application_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aon"."anime" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"title_zh" text,
	"title_jp" text,
	"description" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aon"."source_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anime_id" uuid NOT NULL,
	"user_id" uuid,
	"type" "aon"."source_type" DEFAULT 'manual' NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aon"."user_anime" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"anime_id" uuid NOT NULL,
	"status" "aon"."watch_status" DEFAULT 'planned' NOT NULL,
	"current_episode" integer DEFAULT 0 NOT NULL,
	"priority" "aon"."anime_priority" DEFAULT 'normal' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"private_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_anime_user_anime_unique" UNIQUE("user_id","anime_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aon"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discord_id" text NOT NULL,
	"discord_username" text NOT NULL,
	"discord_global_name" text,
	"discord_avatar" text,
	"role" "aon"."user_role" DEFAULT 'pending' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aon"."watch_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"anime_id" uuid NOT NULL,
	"episode_number" integer NOT NULL,
	"source_link_id" uuid,
	"watched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"progress" real,
	"completed" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aon"."access_applications" ADD CONSTRAINT "access_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "aon"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aon"."access_applications" ADD CONSTRAINT "access_applications_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "aon"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aon"."anime" ADD CONSTRAINT "anime_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "aon"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aon"."source_links" ADD CONSTRAINT "source_links_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "aon"."anime"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aon"."source_links" ADD CONSTRAINT "source_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "aon"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aon"."user_anime" ADD CONSTRAINT "user_anime_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "aon"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aon"."user_anime" ADD CONSTRAINT "user_anime_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "aon"."anime"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aon"."watch_sessions" ADD CONSTRAINT "watch_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "aon"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aon"."watch_sessions" ADD CONSTRAINT "watch_sessions_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "aon"."anime"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aon"."watch_sessions" ADD CONSTRAINT "watch_sessions_source_link_id_source_links_id_fk" FOREIGN KEY ("source_link_id") REFERENCES "aon"."source_links"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_applications_user_idx" ON "aon"."access_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_applications_status_idx" ON "aon"."access_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_links_anime_idx" ON "aon"."source_links" USING btree ("anime_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_anime_user_idx" ON "aon"."user_anime" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watch_sessions_user_idx" ON "aon"."watch_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watch_sessions_user_anime_idx" ON "aon"."watch_sessions" USING btree ("user_id","anime_id");