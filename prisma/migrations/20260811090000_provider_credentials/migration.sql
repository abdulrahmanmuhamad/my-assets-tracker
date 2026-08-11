CREATE TABLE "provider_credentials" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "credential_encrypted" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "provider_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "provider_credentials_user_id_provider_key" ON "provider_credentials"("user_id", "provider");
CREATE INDEX "provider_credentials_user_id_provider_idx" ON "provider_credentials"("user_id", "provider");
