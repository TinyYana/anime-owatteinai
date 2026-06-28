ALTER TABLE "aon"."users" ADD COLUMN IF NOT EXISTS "daily_dm_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "aon"."users" ADD COLUMN IF NOT EXISTS "daily_dm_include_community" boolean NOT NULL DEFAULT true;
ALTER TABLE "aon"."users" ADD COLUMN IF NOT EXISTS "daily_dm_last_sent_at" timestamp with time zone;
