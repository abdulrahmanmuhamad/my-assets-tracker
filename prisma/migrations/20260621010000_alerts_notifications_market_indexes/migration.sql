-- Alert rules, in-app/email events, preferences, delivery logs, and shared market-index cache.
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "asset_category" TEXT NOT NULL,
    "asset_id" TEXT,
    "symbol" TEXT,
    "alert_type" TEXT NOT NULL,
    "comparison_operator" TEXT NOT NULL,
    "threshold_value" DECIMAL(24,8),
    "threshold_percent" DECIMAL(12,6),
    "baseline_value" DECIMAL(24,8),
    "baseline_roi" DECIMAL(12,6),
    "due_date" TIMESTAMP(3),
    "remind_before_days" INTEGER,
    "recurrence" TEXT NOT NULL DEFAULT 'none',
    "notification_channels" JSONB NOT NULL DEFAULT '["in_app"]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_checked_at" TIMESTAMP(3),
    "last_triggered_at" TIMESTAMP(3),
    "cooldown_minutes" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "alert_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "alert_rule_id" TEXT NOT NULL,
    "asset_category" TEXT NOT NULL,
    "asset_id" TEXT,
    "symbol" TEXT,
    "event_title" TEXT NOT NULL,
    "event_message" TEXT NOT NULL,
    "trigger_value" DECIMAL(24,8),
    "trigger_percent" DECIMAL(12,6),
    "threshold_value" DECIMAL(24,8),
    "threshold_percent" DECIMAL(12,6),
    "notification_channels" JSONB NOT NULL DEFAULT '["in_app"]',
    "delivery_status" TEXT NOT NULL DEFAULT 'pending',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_alerts_enabled" BOOLEAN NOT NULL DEFAULT true,
    "in_app_alerts_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_alerts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "alert_email" TEXT,
    "phone_number" TEXT,
    "quiet_hours_enabled" BOOLEAN NOT NULL DEFAULT false,
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "alert_delivery_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "alert_event_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alert_delivery_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "market_index_price_cache" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(24,8) NOT NULL,
    "change_amount" DECIMAL(24,8) NOT NULL,
    "change_percent" DECIMAL(12,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "source" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "market_index_price_cache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");
CREATE UNIQUE INDEX "market_index_price_cache_symbol_key" ON "market_index_price_cache"("symbol");
CREATE INDEX "alert_rules_user_id_status_asset_category_idx" ON "alert_rules"("user_id", "status", "asset_category");
CREATE INDEX "alert_rules_user_id_asset_id_idx" ON "alert_rules"("user_id", "asset_id");
CREATE INDEX "alert_rules_user_id_symbol_idx" ON "alert_rules"("user_id", "symbol");
CREATE INDEX "alert_events_user_id_read_at_created_at_idx" ON "alert_events"("user_id", "read_at", "created_at");
CREATE INDEX "alert_events_alert_rule_id_created_at_idx" ON "alert_events"("alert_rule_id", "created_at");
CREATE INDEX "alert_delivery_logs_user_id_alert_event_id_channel_idx" ON "alert_delivery_logs"("user_id", "alert_event_id", "channel");

ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alert_delivery_logs" ADD CONSTRAINT "alert_delivery_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alert_delivery_logs" ADD CONSTRAINT "alert_delivery_logs_alert_event_id_fkey" FOREIGN KEY ("alert_event_id") REFERENCES "alert_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
