CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_categories" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mineral_transactions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "mineral_type" TEXT NOT NULL,
  "purchase_date" TIMESTAMP(3) NOT NULL,
  "purchase_price" DECIMAL(18,2) NOT NULL,
  "purchase_currency" TEXT NOT NULL DEFAULT 'USD',
  "quantity" DECIMAL(18,6) NOT NULL,
  "unit" TEXT NOT NULL,
  "quantity_in_grams" DECIMAL(18,6) NOT NULL,
  "purchase_location" TEXT,
  "receipt_number" TEXT,
  "current_price_per_gram" DECIMAL(18,6) NOT NULL,
  "current_value" DECIMAL(18,2) NOT NULL,
  "roi_percent" DECIMAL(10,4) NOT NULL,
  "notes" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mineral_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "real_estate_properties" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "property_name" TEXT NOT NULL,
  "property_type" TEXT NOT NULL,
  "purchase_date" TIMESTAMP(3) NOT NULL,
  "purchase_price" DECIMAL(18,2) NOT NULL,
  "estimated_current_price" DECIMAL(18,2) NOT NULL,
  "address" TEXT,
  "is_paid_off" BOOLEAN NOT NULL DEFAULT false,
  "total_payment_months" INTEGER,
  "months_paid" INTEGER,
  "months_left" INTEGER,
  "monthly_payment" DECIMAL(18,2),
  "remaining_balance" DECIMAL(18,2),
  "is_rented" BOOLEAN NOT NULL DEFAULT false,
  "monthly_rent" DECIMAL(18,2),
  "rent_start_date" TIMESTAMP(3),
  "monthly_expenses" JSONB NOT NULL DEFAULT '{}',
  "monthly_net_cash_flow" DECIMAL(18,2) NOT NULL,
  "equity" DECIMAL(18,2) NOT NULL,
  "roi_percent" DECIMAL(10,4) NOT NULL,
  "notes" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "real_estate_properties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "jewelry_items" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "jewelry_type" TEXT NOT NULL,
  "item_name" TEXT NOT NULL,
  "purchase_date" TIMESTAMP(3) NOT NULL,
  "purchase_price" DECIMAL(18,2) NOT NULL,
  "estimated_price_now" DECIMAL(18,2),
  "weight" DECIMAL(18,6) NOT NULL,
  "unit" TEXT NOT NULL,
  "weight_in_grams" DECIMAL(18,6) NOT NULL,
  "price_per_gram" DECIMAL(18,6),
  "karat" DECIMAL(5,2),
  "purity_percent" DECIMAL(6,3),
  "gemstone_type" TEXT,
  "carat_weight" DECIMAL(18,6),
  "current_value" DECIMAL(18,2) NOT NULL,
  "roi_percent" DECIMAL(10,4) NOT NULL,
  "purchase_location" TEXT,
  "receipt_number" TEXT,
  "notes" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "jewelry_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_files" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "asset_type" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "file_type" TEXT NOT NULL,
  "file_url" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "asset_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "price_cache" (
  "id" TEXT NOT NULL,
  "symbol" TEXT NOT NULL,
  "price_per_gram" DECIMAL(18,6) NOT NULL,
  "price_per_troy_ounce" DECIMAL(18,6) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "source" TEXT NOT NULL,
  "fetched_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "price_cache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "settings" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "default_currency" TEXT NOT NULL DEFAULT 'USD',
  "preferred_mineral_unit" TEXT NOT NULL DEFAULT 'troy ounce',
  "preferred_jewelry_weight_unit" TEXT NOT NULL DEFAULT 'gram',
  "live_price_provider" TEXT NOT NULL DEFAULT 'manual',
  "manual_price_overrides" JSONB NOT NULL DEFAULT '{}',
  "dashboard_visibility" JSONB NOT NULL DEFAULT '{}',
  "theme" TEXT NOT NULL DEFAULT 'system',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "asset_categories_user_id_name_key" ON "asset_categories"("user_id", "name");
CREATE INDEX "mineral_transactions_user_id_mineral_type_idx" ON "mineral_transactions"("user_id", "mineral_type");
CREATE INDEX "mineral_transactions_user_id_sort_order_idx" ON "mineral_transactions"("user_id", "sort_order");
CREATE INDEX "real_estate_properties_user_id_property_type_idx" ON "real_estate_properties"("user_id", "property_type");
CREATE INDEX "real_estate_properties_user_id_sort_order_idx" ON "real_estate_properties"("user_id", "sort_order");
CREATE INDEX "jewelry_items_user_id_jewelry_type_idx" ON "jewelry_items"("user_id", "jewelry_type");
CREATE INDEX "jewelry_items_user_id_sort_order_idx" ON "jewelry_items"("user_id", "sort_order");
CREATE INDEX "asset_files_user_id_asset_type_asset_id_idx" ON "asset_files"("user_id", "asset_type", "asset_id");
CREATE UNIQUE INDEX "price_cache_symbol_key" ON "price_cache"("symbol");
CREATE UNIQUE INDEX "settings_user_id_key" ON "settings"("user_id");

ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mineral_transactions" ADD CONSTRAINT "mineral_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "real_estate_properties" ADD CONSTRAINT "real_estate_properties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "jewelry_items" ADD CONSTRAINT "jewelry_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_files" ADD CONSTRAINT "asset_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

