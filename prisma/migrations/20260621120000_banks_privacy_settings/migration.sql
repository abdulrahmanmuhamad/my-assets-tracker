ALTER TABLE "settings"
ADD COLUMN "include_liquid_cash_in_portfolio" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "financial_values_hidden_by_default" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "bank_connections" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'plaid',
  "provider_item_id" TEXT,
  "provider_access_token_encrypted" TEXT,
  "institution_id" TEXT,
  "institution_name" TEXT NOT NULL DEFAULT 'Connected bank',
  "institution_logo_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "products_enabled" JSONB NOT NULL DEFAULT '[]',
  "transactions_cursor" TEXT,
  "sync_warning" TEXT,
  "last_synced_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bank_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_accounts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "bank_connection_id" TEXT NOT NULL,
  "provider_account_id" TEXT NOT NULL,
  "institution_name" TEXT NOT NULL,
  "account_name" TEXT NOT NULL,
  "official_name" TEXT,
  "account_type" TEXT NOT NULL,
  "account_subtype" TEXT,
  "mask" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "current_balance" DECIMAL(18,2),
  "available_balance" DECIMAL(18,2),
  "credit_limit" DECIMAL(18,2),
  "include_in_liquid_cash" BOOLEAN NOT NULL DEFAULT false,
  "is_debt_account" BOOLEAN NOT NULL DEFAULT false,
  "sync_status" TEXT NOT NULL DEFAULT 'synced',
  "last_balance_updated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_transactions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "bank_account_id" TEXT NOT NULL,
  "bank_connection_id" TEXT NOT NULL,
  "provider_transaction_id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "authorized_date" TIMESTAMP(3),
  "name" TEXT NOT NULL,
  "merchant_name" TEXT,
  "category" TEXT,
  "personal_finance_category" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "pending" BOOLEAN NOT NULL DEFAULT false,
  "payment_channel" TEXT,
  "transaction_type" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_sync_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "bank_connection_id" TEXT,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  CONSTRAINT "bank_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bank_connections_provider_provider_item_id_key" ON "bank_connections"("provider", "provider_item_id");
CREATE INDEX "bank_connections_user_id_provider_status_idx" ON "bank_connections"("user_id", "provider", "status");
CREATE UNIQUE INDEX "bank_accounts_bank_connection_id_provider_account_id_key" ON "bank_accounts"("bank_connection_id", "provider_account_id");
CREATE INDEX "bank_accounts_user_id_bank_connection_id_idx" ON "bank_accounts"("user_id", "bank_connection_id");
CREATE INDEX "bank_accounts_user_id_account_type_account_subtype_idx" ON "bank_accounts"("user_id", "account_type", "account_subtype");
CREATE UNIQUE INDEX "bank_transactions_bank_connection_id_provider_transaction_id_key" ON "bank_transactions"("bank_connection_id", "provider_transaction_id");
CREATE INDEX "bank_transactions_user_id_bank_account_id_date_idx" ON "bank_transactions"("user_id", "bank_account_id", "date");
CREATE INDEX "bank_transactions_user_id_amount_date_idx" ON "bank_transactions"("user_id", "amount", "date");
CREATE INDEX "bank_sync_logs_user_id_bank_connection_id_started_at_idx" ON "bank_sync_logs"("user_id", "bank_connection_id", "started_at");

ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_bank_connection_id_fkey" FOREIGN KEY ("bank_connection_id") REFERENCES "bank_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_connection_id_fkey" FOREIGN KEY ("bank_connection_id") REFERENCES "bank_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_sync_logs" ADD CONSTRAINT "bank_sync_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_sync_logs" ADD CONSTRAINT "bank_sync_logs_bank_connection_id_fkey" FOREIGN KEY ("bank_connection_id") REFERENCES "bank_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
