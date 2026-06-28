CREATE TABLE IF NOT EXISTS "aon"."anime_edit_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anime_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "aon"."application_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"note" text,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aon"."anime_edit_requests" ADD CONSTRAINT "anime_edit_requests_anime_id_anime_id_fk" FOREIGN KEY ("anime_id") REFERENCES "aon"."anime"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aon"."anime_edit_requests" ADD CONSTRAINT "anime_edit_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "aon"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aon"."anime_edit_requests" ADD CONSTRAINT "anime_edit_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "aon"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anime_edit_requests_anime_idx" ON "aon"."anime_edit_requests" USING btree ("anime_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anime_edit_requests_status_idx" ON "aon"."anime_edit_requests" USING btree ("status");