ALTER TYPE "aon"."user_role" ADD VALUE IF NOT EXISTS 'moderator' AFTER 'admin';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aon"."role_permissions" (
	"role" text NOT NULL,
	"permission" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_permission_unique" UNIQUE("role","permission")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_role_idx" ON "aon"."role_permissions" USING btree ("role");
--> statement-breakpoint
INSERT INTO "aon"."role_permissions" ("role", "permission", "enabled") VALUES
	('owner', 'app.access', true),
	('owner', 'admin.access', true),
	('owner', 'applications.review', true),
	('owner', 'users.manage', true),
	('owner', 'roles.manage', true),
	('owner', 'anime.manage', true),
	('owner', 'audit.view', true),
	('admin', 'app.access', true),
	('admin', 'admin.access', true),
	('admin', 'applications.review', true),
	('admin', 'users.manage', true),
	('admin', 'roles.manage', true),
	('admin', 'anime.manage', true),
	('admin', 'audit.view', true),
	('moderator', 'app.access', true),
	('moderator', 'admin.access', true),
	('moderator', 'applications.review', true),
	('moderator', 'users.manage', false),
	('moderator', 'roles.manage', false),
	('moderator', 'anime.manage', true),
	('moderator', 'audit.view', true),
	('member', 'app.access', true),
	('member', 'admin.access', false),
	('member', 'applications.review', false),
	('member', 'users.manage', false),
	('member', 'roles.manage', false),
	('member', 'anime.manage', false),
	('member', 'audit.view', false),
	('pending', 'app.access', false),
	('pending', 'admin.access', false),
	('pending', 'applications.review', false),
	('pending', 'users.manage', false),
	('pending', 'roles.manage', false),
	('pending', 'anime.manage', false),
	('pending', 'audit.view', false),
	('banned', 'app.access', false),
	('banned', 'admin.access', false),
	('banned', 'applications.review', false),
	('banned', 'users.manage', false),
	('banned', 'roles.manage', false),
	('banned', 'anime.manage', false),
	('banned', 'audit.view', false)
ON CONFLICT ("role", "permission") DO NOTHING;
