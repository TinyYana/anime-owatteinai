ALTER TABLE "aon"."access_applications" ADD COLUMN "review_reason" text;--> statement-breakpoint
ALTER TABLE "aon"."anime_edit_requests" ADD COLUMN "review_reason" text;--> statement-breakpoint
ALTER TABLE "aon"."anime_notes" ADD COLUMN "deleted_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "aon"."anime_notes" ADD COLUMN "delete_reason" text;--> statement-breakpoint
ALTER TABLE "aon"."anime_notes" ADD CONSTRAINT "anime_notes_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "aon"."users"("id") ON DELETE set null ON UPDATE no action;
