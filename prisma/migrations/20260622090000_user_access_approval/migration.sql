ALTER TABLE "users"
ADD COLUMN "username" TEXT,
ADD COLUMN "display_name" TEXT,
ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "access_status" TEXT NOT NULL DEFAULT 'pending_email_verification',
ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN "approved_at" TIMESTAMP(3),
ADD COLUMN "approved_by_user_id" TEXT,
ADD COLUMN "rejected_at" TIMESTAMP(3),
ADD COLUMN "suspended_at" TIMESTAMP(3),
ADD COLUMN "last_login_at" TIMESTAMP(3);

-- Existing rows own existing portfolio data and must remain accessible after deployment.
UPDATE "users"
SET
  "email_verified" = true,
  "access_status" = 'approved',
  "role" = 'owner',
  "approved_at" = COALESCE("approved_at", CURRENT_TIMESTAMP);

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

ALTER TABLE "users"
ADD CONSTRAINT "users_username_normalized_check"
CHECK ("username" IS NULL OR "username" = LOWER("username"));

ALTER TABLE "users"
ADD CONSTRAINT "users_access_status_check"
CHECK ("access_status" IN ('pending_email_verification', 'pending_owner_approval', 'approved', 'rejected', 'suspended'));

ALTER TABLE "users"
ADD CONSTRAINT "users_role_check"
CHECK ("role" IN ('owner', 'admin', 'user'));
