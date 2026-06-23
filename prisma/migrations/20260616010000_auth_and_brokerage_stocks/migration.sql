ALTER TABLE "users"
ADD COLUMN "auth_provider_user_id" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "image_url" TEXT;

UPDATE "users"
SET "auth_provider_user_id" = 'legacy:' || COALESCE("email", "id")
WHERE "auth_provider_user_id" IS NULL;

ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

CREATE UNIQUE INDEX "users_auth_provider_user_id_key" ON "users"("auth_provider_user_id");

CREATE TABLE "brokerage_connections" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_item_id" TEXT,
  "provider_access_token_encrypted" TEXT,
  "institution_id" TEXT,
  "institution_name" TEXT NOT NULL DEFAULT 'Connected brokerage',
  "institution_logo_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "last_synced_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brokerage_connections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "brokerage_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "brokerage_accounts" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "brokerage_connection_id" TEXT NOT NULL,
  "provider_account_id" TEXT NOT NULL,
  "broker_name" TEXT NOT NULL,
  "account_name" TEXT NOT NULL,
  "account_type" TEXT NOT NULL DEFAULT 'brokerage',
  "account_subtype" TEXT,
  "mask" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "current_balance" DECIMAL(18,2),
  "available_balance" DECIMAL(18,2),
  "official_name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brokerage_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "brokerage_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "brokerage_accounts_brokerage_connection_id_fkey" FOREIGN KEY ("brokerage_connection_id") REFERENCES "brokerage_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "stock_holdings" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "brokerage_account_id" TEXT NOT NULL,
  "brokerage_connection_id" TEXT NOT NULL,
  "provider_holding_id" TEXT NOT NULL,
  "symbol" TEXT,
  "security_name" TEXT NOT NULL,
  "security_type" TEXT NOT NULL DEFAULT 'other',
  "cusip" TEXT,
  "isin" TEXT,
  "quantity" DECIMAL(24,8) NOT NULL,
  "cost_basis" DECIMAL(18,2),
  "average_cost" DECIMAL(18,6),
  "current_price" DECIMAL(18,6),
  "market_value" DECIMAL(18,2) NOT NULL,
  "unrealized_gain_loss" DECIMAL(18,2),
  "unrealized_gain_loss_percent" DECIMAL(10,4),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "as_of_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stock_holdings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_holdings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "stock_holdings_brokerage_account_id_fkey" FOREIGN KEY ("brokerage_account_id") REFERENCES "brokerage_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "stock_holdings_brokerage_connection_id_fkey" FOREIGN KEY ("brokerage_connection_id") REFERENCES "brokerage_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "stock_transactions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "brokerage_account_id" TEXT NOT NULL,
  "brokerage_connection_id" TEXT NOT NULL,
  "provider_transaction_id" TEXT NOT NULL,
  "symbol" TEXT,
  "security_name" TEXT,
  "transaction_type" TEXT NOT NULL,
  "quantity" DECIMAL(24,8),
  "price" DECIMAL(18,6),
  "amount" DECIMAL(18,2) NOT NULL,
  "fees" DECIMAL(18,2),
  "date" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "stock_transactions_brokerage_account_id_fkey" FOREIGN KEY ("brokerage_account_id") REFERENCES "brokerage_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "stock_transactions_brokerage_connection_id_fkey" FOREIGN KEY ("brokerage_connection_id") REFERENCES "brokerage_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "stock_price_cache" (
  "id" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "price" DECIMAL(18,6) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "source" TEXT NOT NULL,
  "fetched_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "stock_price_cache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "brokerage_sync_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "brokerage_connection_id" TEXT,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  CONSTRAINT "brokerage_sync_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "brokerage_sync_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "brokerage_sync_logs_brokerage_connection_id_fkey" FOREIGN KEY ("brokerage_connection_id") REFERENCES "brokerage_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "brokerage_connections_provider_provider_item_id_key" ON "brokerage_connections"("provider", "provider_item_id");
CREATE INDEX "brokerage_connections_user_id_provider_status_idx" ON "brokerage_connections"("user_id", "provider", "status");

CREATE UNIQUE INDEX "brokerage_accounts_brokerage_connection_id_provider_account_id_key" ON "brokerage_accounts"("brokerage_connection_id", "provider_account_id");
CREATE INDEX "brokerage_accounts_user_id_brokerage_connection_id_idx" ON "brokerage_accounts"("user_id", "brokerage_connection_id");

CREATE UNIQUE INDEX "stock_holdings_brokerage_account_id_provider_holding_id_key" ON "stock_holdings"("brokerage_account_id", "provider_holding_id");
CREATE INDEX "stock_holdings_user_id_brokerage_connection_id_idx" ON "stock_holdings"("user_id", "brokerage_connection_id");
CREATE INDEX "stock_holdings_user_id_symbol_idx" ON "stock_holdings"("user_id", "symbol");

CREATE UNIQUE INDEX "stock_transactions_brokerage_connection_id_provider_transaction_id_key" ON "stock_transactions"("brokerage_connection_id", "provider_transaction_id");
CREATE INDEX "stock_transactions_user_id_brokerage_account_id_date_idx" ON "stock_transactions"("user_id", "brokerage_account_id", "date");

CREATE UNIQUE INDEX "stock_price_cache_symbol_key" ON "stock_price_cache"("symbol");
CREATE INDEX "brokerage_sync_logs_user_id_brokerage_connection_id_started_at_idx" ON "brokerage_sync_logs"("user_id", "brokerage_connection_id", "started_at");
