import { describe, expect, it } from "vitest";
import type { AlertRule } from "@prisma/client";
import { alertRuleInputSchema } from "@/lib/validators";
import {
  calculateNextDueDate,
  evaluateDateReminder,
  evaluateNumericAlert,
  shouldSkipDueToCooldown,
  bankTransactionMetric,
} from "@/lib/alerts/evaluate-alerts";
import { alertOwnershipWhere, notificationOwnershipWhere, notificationReadUpdate } from "@/lib/alerts/access";
import { canUseDevelopmentAuthBypass } from "@/lib/auth-policy";

function numericRule(alertType: string, values: Record<string, unknown> = {}) {
  return {
    name: "Test alert",
    alertType,
    thresholdValue: null,
    thresholdPercent: null,
    baselineValue: null,
    baselineRoi: null,
    ...values,
  } as never;
}

function dateRule(values: Partial<AlertRule> = {}) {
  return {
    id: "rule-1",
    userId: "user-1",
    name: "Mortgage",
    description: null,
    assetCategory: "real_estate",
    assetId: "property-1",
    symbol: null,
    alertType: "payment_due",
    comparisonOperator: "before_due_date",
    thresholdValue: null,
    thresholdPercent: null,
    baselineValue: null,
    baselineRoi: null,
    dueDate: new Date("2026-07-10T00:00:00.000Z"),
    remindBeforeDays: 5,
    recurrence: "monthly",
    notificationChannels: ["in_app"],
    status: "active",
    lastCheckedAt: null,
    lastTriggeredAt: null,
    cooldownMinutes: 60,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...values,
  } as AlertRule;
}

describe("alert validation and evaluation", () => {
  it("validates complete alert creation input and rejects a missing threshold", () => {
    const valid = alertRuleInputSchema.safeParse({
      name: "Gold ROI alert",
      assetCategory: "mineral",
      assetId: "asset-1",
      alertType: "roi_above_percent",
      comparisonOperator: "above",
      thresholdPercent: 20,
      recurrence: "none",
      notificationChannels: ["in_app"],
      cooldownMinutes: 60,
    });
    expect(valid.success).toBe(true);
    expect(alertRuleInputSchema.safeParse({ ...valid.data, thresholdPercent: undefined }).success).toBe(false);
  });

  it("evaluates ROI above and below thresholds", () => {
    expect(evaluateNumericAlert(numericRule("roi_above_percent", { thresholdPercent: 20 }), null, 25, "Gold").triggered).toBe(true);
    expect(evaluateNumericAlert(numericRule("roi_below_percent", { thresholdPercent: 5 }), null, 3, "Gold").triggered).toBe(true);
  });

  it("evaluates price above and below thresholds", () => {
    expect(evaluateNumericAlert(numericRule("price_above", { thresholdValue: 100 }), 110, null, "AAPL").triggered).toBe(true);
    expect(evaluateNumericAlert(numericRule("price_below", { thresholdValue: 100 }), 90, null, "AAPL").triggered).toBe(true);
  });

  it("evaluates bank cash and large transaction alerts", () => {
    expect(evaluateNumericAlert(numericRule("bank_cash_below", { thresholdValue: 1000 }), 900, null, "Bank portfolio").triggered).toBe(true);
    expect(evaluateNumericAlert(numericRule("bank_debt_above", { thresholdValue: 500 }), 700, null, "Bank portfolio").triggered).toBe(true);
    expect(bankTransactionMetric("bank_transaction_amount_above", -1250)).toBe(1250);
    expect(bankTransactionMetric("bank_deposit_above", -800)).toBe(800);
    expect(bankTransactionMetric("bank_deposit_above", 800)).toBeNull();
    expect(bankTransactionMetric("bank_withdrawal_above", 600)).toBe(600);
  });

  it("evaluates increases and decreases from a baseline", () => {
    const increased = evaluateNumericAlert(numericRule("price_increased_by_percent", { baselineValue: 100, thresholdPercent: 10 }), 112, null, "Index");
    const decreased = evaluateNumericAlert(numericRule("price_decreased_by_percent", { baselineValue: 100, thresholdPercent: 10 }), 88, null, "Index");
    expect(increased.triggered).toBe(true);
    expect(decreased.triggered).toBe(true);
  });

  it("evaluates mortgage and rent reminders and advances monthly dates", () => {
    expect(evaluateDateReminder(dateRule(), new Date("2026-07-05T12:00:00.000Z")).triggered).toBe(true);
    expect(evaluateDateReminder(dateRule({ alertType: "rent_due", remindBeforeDays: 3 }), new Date("2026-07-07T12:00:00.000Z")).triggered).toBe(true);
    expect(calculateNextDueDate(new Date("2026-07-10T00:00:00.000Z"), "monthly").toISOString().slice(0, 10)).toBe("2026-08-10");
  });

  it("prevents duplicate notifications during cooldown", () => {
    expect(shouldSkipDueToCooldown({ lastTriggeredAt: new Date("2026-07-01T12:00:00Z"), cooldownMinutes: 60 }, new Date("2026-07-01T12:30:00Z"))).toBe(true);
    expect(shouldSkipDueToCooldown({ lastTriggeredAt: new Date("2026-07-01T12:00:00Z"), cooldownMinutes: 60 }, new Date("2026-07-01T13:01:00Z"))).toBe(false);
  });

  it("builds ownership predicates with both user and record ID", () => {
    expect(alertOwnershipWhere("user-a", "alert-1")).toEqual({ id: "alert-1", userId: "user-a" });
    expect(notificationOwnershipWhere("user-b", "event-1")).toEqual({ id: "event-1", userId: "user-b" });
  });

  it("marks unread notifications once and preserves an existing read time", () => {
    const now = new Date("2026-07-01T12:00:00Z");
    expect(notificationReadUpdate(null, now).readAt).toBe(now);
    const existing = new Date("2026-06-01T12:00:00Z");
    expect(notificationReadUpdate(existing, now).readAt).toBe(existing);
  });

  it("never permits the development bypass in production", () => {
    expect(canUseDevelopmentAuthBypass({ clerkConfigured: false, nodeEnv: "production", allowDevAuthBypass: "true" })).toBe(false);
    expect(canUseDevelopmentAuthBypass({ clerkConfigured: false, nodeEnv: "development", allowDevAuthBypass: "true" })).toBe(true);
    expect(canUseDevelopmentAuthBypass({ clerkConfigured: false, nodeEnv: "development", allowDevAuthBypass: "false" })).toBe(false);
    expect(canUseDevelopmentAuthBypass({ clerkConfigured: false, nodeEnv: "development" })).toBe(false);
    expect(canUseDevelopmentAuthBypass({ clerkConfigured: true, nodeEnv: "development", allowDevAuthBypass: "true" })).toBe(false);
  });
});
