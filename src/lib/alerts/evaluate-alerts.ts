import type { AlertEvent, AlertRule, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateGoldPurity,
  calculateJewelryCurrentValue,
  calculateMineralCurrentValue,
  calculateROI,
  toNumber,
} from "@/lib/calculations";
import { METAL_SYMBOL_BY_NAME } from "@/lib/constants";
import { getMarketIndex, getMarketIndexes } from "@/lib/market-data/index-prices";
import { sendEmailNotification } from "@/lib/notifications/email-provider";
import { calculateAllBanksSummary } from "@/lib/banks/calculations";
import { isAlertCategoryEnabled } from "@/lib/features";

export type AlertEvaluationResult = {
  triggered: boolean;
  title: string;
  message: string;
  triggerValue?: number | null;
  triggerPercent?: number | null;
};

type NumericRule = Pick<
  AlertRule,
  "name" | "alertType" | "thresholdValue" | "thresholdPercent" | "baselineValue" | "baselineRoi"
>;

function percentChange(current: number, baseline: number) {
  return baseline === 0 ? 0 : ((current - baseline) / Math.abs(baseline)) * 100;
}

export function evaluateNumericAlert(
  rule: NumericRule,
  currentValue: number | null,
  currentPercent: number | null,
  subject: string,
): AlertEvaluationResult {
  const thresholdValue = rule.thresholdValue === null ? null : toNumber(rule.thresholdValue);
  const thresholdPercent = rule.thresholdPercent === null ? null : toNumber(rule.thresholdPercent);
  const baselineValue = rule.baselineValue === null ? null : toNumber(rule.baselineValue);
  const baselineRoi = rule.baselineRoi === null ? null : toNumber(rule.baselineRoi);
  let triggered = false;
  let measuredPercent = currentPercent;

  switch (rule.alertType) {
    case "roi_above_percent":
    case "daily_change_above_percent":
      triggered = currentPercent !== null && thresholdPercent !== null && currentPercent >= thresholdPercent;
      break;
    case "roi_below_percent":
    case "daily_change_below_percent":
      triggered = currentPercent !== null && thresholdPercent !== null && currentPercent <= thresholdPercent;
      break;
    case "roi_increased_by_percent":
      measuredPercent = currentPercent !== null && baselineRoi !== null ? currentPercent - baselineRoi : null;
      triggered = measuredPercent !== null && thresholdPercent !== null && measuredPercent >= thresholdPercent;
      break;
    case "roi_decreased_by_percent":
      measuredPercent = currentPercent !== null && baselineRoi !== null ? baselineRoi - currentPercent : null;
      triggered = measuredPercent !== null && thresholdPercent !== null && measuredPercent >= thresholdPercent;
      break;
    case "price_increased_by_percent":
      measuredPercent = currentValue !== null && baselineValue !== null ? percentChange(currentValue, baselineValue) : null;
      triggered = measuredPercent !== null && thresholdPercent !== null && measuredPercent >= thresholdPercent;
      break;
    case "price_decreased_by_percent":
      measuredPercent = currentValue !== null && baselineValue !== null ? -percentChange(currentValue, baselineValue) : null;
      triggered = measuredPercent !== null && thresholdPercent !== null && measuredPercent >= thresholdPercent;
      break;
    case "price_above":
    case "value_above":
    case "unrealized_gain_above":
    case "bank_cash_above":
    case "bank_debt_above":
    case "bank_account_balance_above":
    case "bank_transaction_amount_above":
    case "bank_deposit_above":
    case "bank_withdrawal_above":
      triggered = currentValue !== null && thresholdValue !== null && currentValue >= thresholdValue;
      break;
    case "price_below":
    case "value_below":
    case "unrealized_gain_below":
    case "bank_cash_below":
    case "bank_debt_below":
    case "bank_net_cash_below":
    case "bank_account_balance_below":
      triggered = currentValue !== null && thresholdValue !== null && currentValue <= thresholdValue;
      break;
  }

  const measured = measuredPercent !== null ? `${measuredPercent.toFixed(2)}%` : currentValue !== null ? currentValue.toFixed(2) : "unavailable";
  return {
    triggered,
    title: `${rule.name}: ${subject}`,
    message: `${subject} currently measures ${measured}.`,
    triggerValue: currentValue,
    triggerPercent: measuredPercent,
  };
}

export function shouldSkipDueToCooldown(
  rule: Pick<AlertRule, "lastTriggeredAt" | "cooldownMinutes">,
  now = new Date(),
) {
  if (!rule.lastTriggeredAt || rule.cooldownMinutes <= 0) return false;
  return now.getTime() - rule.lastTriggeredAt.getTime() < rule.cooldownMinutes * 60_000;
}

export function bankTransactionMetric(alertType: string, amount: number | null) {
  if (amount === null) return null;
  if (alertType === "bank_deposit_above") return amount < 0 ? Math.abs(amount) : null;
  if (alertType === "bank_withdrawal_above") return amount > 0 ? amount : null;
  return Math.abs(amount);
}

export function calculateNextDueDate(dueDate: Date, recurrence: string) {
  const next = new Date(dueDate);
  if (recurrence === "daily") next.setUTCDate(next.getUTCDate() + 1);
  if (recurrence === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  if (recurrence === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  if (recurrence === "quarterly") next.setUTCMonth(next.getUTCMonth() + 3);
  if (recurrence === "yearly") next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

export function evaluateDateReminder(rule: AlertRule, now = new Date()): AlertEvaluationResult {
  if (!rule.dueDate) {
    return { triggered: false, title: rule.name, message: "Reminder has no due date." };
  }
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const due = new Date(Date.UTC(rule.dueDate.getUTCFullYear(), rule.dueDate.getUTCMonth(), rule.dueDate.getUTCDate()));
  const reminderDate = new Date(due);
  reminderDate.setUTCDate(reminderDate.getUTCDate() - (rule.remindBeforeDays || 0));
  const triggered = today >= reminderDate;
  const label = rule.alertType === "rent_due" ? "Rent collection" : rule.alertType === "payment_due" ? "Property payment" : rule.alertType === "credit_card_payment_due" ? "Credit-card payment" : "Property reminder";
  return {
    triggered,
    title: `${label}: ${rule.name}`,
    message: `${label} is due on ${due.toISOString().slice(0, 10)}.`,
  };
}

function mineralPurity(ruleAsset: { mineralType: string; karat: unknown; purityPercent: unknown }) {
  if (ruleAsset.mineralType === "Gold") return calculateGoldPurity(ruleAsset.karat as never) || 1;
  const purity = toNumber(ruleAsset.purityPercent as never);
  return purity > 0 ? Math.min(purity, 100) / 100 : 1;
}

export async function evaluateMineralAlert(rule: AlertRule) {
  const asset = rule.assetId
    ? await prisma.mineralTransaction.findFirst({ where: { id: rule.assetId, userId: rule.userId } })
    : null;
  const symbol = rule.symbol || (asset ? METAL_SYMBOL_BY_NAME[asset.mineralType] : null);
  const cachedPrice = symbol ? await prisma.priceCache.findUnique({ where: { symbol } }) : null;
  const pricePerGram = cachedPrice ? toNumber(cachedPrice.pricePerGram) : asset ? toNumber(asset.currentPricePerGram) : null;
  const currentValue =
    asset && pricePerGram !== null
      ? calculateMineralCurrentValue(toNumber(asset.quantityInGrams) * mineralPurity(asset), pricePerGram)
      : null;
  const roi = asset && currentValue !== null ? calculateROI(currentValue, asset.purchasePrice) : null;
  const subject = asset?.mineralType || symbol || "Mineral";
  const metric = rule.alertType.startsWith("price_") ? pricePerGram : rule.alertType.startsWith("roi_") ? null : currentValue;
  return evaluateNumericAlert(rule, metric, roi, subject);
}

export async function evaluateJewelryAlert(rule: AlertRule) {
  const asset = rule.assetId
    ? await prisma.jewelryItem.findFirst({ where: { id: rule.assetId, userId: rule.userId } })
    : null;
  if (!asset) return evaluateNumericAlert(rule, null, null, rule.symbol || "Jewelry");

  const symbol = rule.symbol || METAL_SYMBOL_BY_NAME[asset.jewelryType];
  const cachedPrice = symbol ? await prisma.priceCache.findUnique({ where: { symbol } }) : null;
  const pricePerGram = cachedPrice ? toNumber(cachedPrice.pricePerGram) : asset.pricePerGram === null ? 0 : toNumber(asset.pricePerGram);
  const currentValue = calculateJewelryCurrentValue({
    jewelryType: asset.jewelryType,
    weightInGrams: asset.weightInGrams,
    pricePerGram,
    karat: asset.karat,
    purityPercent: asset.purityPercent,
    estimatedPriceNow: asset.estimatedPriceNow,
  });
  const roi = calculateROI(currentValue, asset.purchasePrice);
  const metric = rule.alertType.startsWith("price_") ? pricePerGram : rule.alertType.startsWith("roi_") ? null : currentValue;
  return evaluateNumericAlert(rule, metric, roi, asset.itemName);
}

export async function evaluateStockAlert(rule: AlertRule) {
  let currentValue: number | null = null;
  let currentPercent: number | null = null;
  let subject = rule.symbol || "Stocks portfolio";

  if (rule.assetId && rule.symbol === "__ACCOUNT__") {
    const [account, holdings] = await Promise.all([
      prisma.brokerageAccount.findFirst({ where: { id: rule.assetId, userId: rule.userId } }),
      prisma.stockHolding.findMany({ where: { brokerageAccountId: rule.assetId, userId: rule.userId } }),
    ]);
    const totalValue = holdings.reduce((sum, holding) => sum + toNumber(holding.marketValue), 0);
    const knownCost = holdings.reduce((sum, holding) => sum + (holding.costBasis === null ? 0 : toNumber(holding.costBasis)), 0);
    subject = account?.accountName || "Brokerage account";
    currentValue = totalValue;
    currentPercent = knownCost > 0 ? calculateROI(totalValue, knownCost) : null;
  } else if (rule.assetId) {
    const holding = await prisma.stockHolding.findFirst({ where: { id: rule.assetId, userId: rule.userId } });
    if (holding) {
      subject = holding.symbol || holding.securityName;
      currentPercent = holding.unrealizedGainLossPercent === null ? null : toNumber(holding.unrealizedGainLossPercent);
      currentValue = rule.alertType.startsWith("price_")
        ? holding.currentPrice === null
          ? null
          : toNumber(holding.currentPrice)
        : rule.alertType.startsWith("unrealized_gain_")
          ? holding.unrealizedGainLoss === null
            ? null
            : toNumber(holding.unrealizedGainLoss)
          : toNumber(holding.marketValue);
    }
  } else {
    const holdings = await prisma.stockHolding.findMany({ where: { userId: rule.userId } });
    const totalValue = holdings.reduce((sum, holding) => sum + toNumber(holding.marketValue), 0);
    const knownCost = holdings.reduce((sum, holding) => sum + (holding.costBasis === null ? 0 : toNumber(holding.costBasis)), 0);
    subject = "Total stocks portfolio";
    currentValue = totalValue;
    currentPercent = knownCost > 0 ? calculateROI(totalValue, knownCost) : null;
  }

  const numericValue = rule.alertType.startsWith("roi_") ? null : currentValue;
  return evaluateNumericAlert(rule, numericValue, currentPercent, subject);
}

export async function evaluateMarketIndexAlert(rule: AlertRule) {
  const quote = rule.symbol ? await getMarketIndex(rule.symbol, false) : null;
  const currentValue = quote?.price ?? null;
  const currentPercent = quote?.changePercent ?? null;
  return evaluateNumericAlert(rule, currentValue, currentPercent, quote?.name || rule.symbol || "Market index");
}

export async function evaluateRealEstateAlert(rule: AlertRule, now = new Date()) {
  if (["payment_due", "rent_due", "custom_date_reminder"].includes(rule.alertType)) {
    return evaluateDateReminder(rule, now);
  }
  const property = rule.assetId
    ? await prisma.realEstateProperty.findFirst({ where: { id: rule.assetId, userId: rule.userId } })
    : null;
  const value = property ? toNumber(property.estimatedCurrentPrice) : null;
  const roi = property ? calculateROI(property.estimatedCurrentPrice, property.purchasePrice) : null;
  return evaluateNumericAlert(rule, value, roi, property?.propertyName || "Property");
}

export async function evaluateBankAlert(rule: AlertRule, now = new Date()) {
  if (rule.alertType === "credit_card_payment_due") return evaluateDateReminder(rule, now);

  if (rule.assetCategory === "bank_account") {
    const account = rule.assetId ? await prisma.bankAccount.findFirst({ where: { id: rule.assetId, userId: rule.userId } }) : null;
    return evaluateNumericAlert(
      rule,
      account?.currentBalance === null || account?.currentBalance === undefined ? null : toNumber(account.currentBalance),
      null,
      account?.accountName || "Bank account",
    );
  }

  if (rule.assetCategory === "bank_transaction") {
    const transaction = rule.assetId
      ? await prisma.bankTransaction.findFirst({ where: { id: rule.assetId, userId: rule.userId } })
      : await prisma.bankTransaction.findFirst({ where: { userId: rule.userId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
    const amount = transaction ? toNumber(transaction.amount) : null;
    return evaluateNumericAlert(
      rule,
      bankTransactionMetric(rule.alertType, amount),
      null,
      transaction?.merchantName || transaction?.name || "Bank transaction",
    );
  }

  const accounts = await prisma.bankAccount.findMany({ where: { userId: rule.userId } });
  const summary = calculateAllBanksSummary(accounts.map((account) => ({
    accountType: account.accountType,
    accountSubtype: account.accountSubtype,
    currentBalance: account.currentBalance === null ? null : toNumber(account.currentBalance),
    includeInLiquidCash: account.includeInLiquidCash,
    isDebtAccount: account.isDebtAccount,
  })));
  const currentValue = rule.alertType.startsWith("bank_cash_")
    ? summary.liquidCash
    : rule.alertType.startsWith("bank_debt_")
      ? summary.creditCardDebt
      : summary.netCashAfterDebt;
  return evaluateNumericAlert(rule, currentValue, null, "Bank portfolio");
}

async function evaluateRule(rule: AlertRule, now: Date) {
  if (rule.assetCategory === "mineral") return evaluateMineralAlert(rule);
  if (rule.assetCategory === "jewelry") return evaluateJewelryAlert(rule);
  if (rule.assetCategory === "stock") return evaluateStockAlert(rule);
  if (rule.assetCategory === "market_index") return evaluateMarketIndexAlert(rule);
  if (rule.assetCategory === "real_estate") return evaluateRealEstateAlert(rule, now);
  if (["bank", "bank_account", "bank_transaction"].includes(rule.assetCategory)) return evaluateBankAlert(rule, now);
  return { triggered: false, title: rule.name, message: "Unsupported alert category." };
}

export async function createAlertEvent(rule: AlertRule, result: AlertEvaluationResult) {
  return prisma.alertEvent.create({
    data: {
      userId: rule.userId,
      alertRuleId: rule.id,
      assetCategory: rule.assetCategory,
      assetId: rule.assetId,
      symbol: rule.symbol,
      eventTitle: result.title,
      eventMessage: result.message,
      triggerValue: result.triggerValue,
      triggerPercent: result.triggerPercent,
      thresholdValue: rule.thresholdValue,
      thresholdPercent: rule.thresholdPercent,
      notificationChannels: rule.notificationChannels as Prisma.InputJsonValue,
    },
  });
}

function inQuietHours(start?: string | null, end?: string | null, now = new Date()) {
  if (!start || !end) return false;
  const current = now.getUTCHours() * 60 + now.getUTCMinutes();
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const from = startHour * 60 + startMinute;
  const to = endHour * 60 + endMinute;
  return from <= to ? current >= from && current < to : current >= from || current < to;
}

export async function sendAlertNotifications(event: AlertEvent) {
  const [user, preferences] = await Promise.all([
    prisma.user.findUnique({ where: { id: event.userId } }),
    prisma.notificationPreference.findUnique({ where: { userId: event.userId } }),
  ]);
  const channels = Array.isArray(event.notificationChannels)
    ? event.notificationChannels.filter((channel): channel is string => typeof channel === "string")
    : [];
  const successes: string[] = [];
  const failures: string[] = [];

  for (const channel of channels) {
    try {
      if (channel === "in_app") {
        if (preferences && !preferences.inAppAlertsEnabled) throw new Error("In-app alerts are disabled");
        await prisma.alertDeliveryLog.create({
          data: { userId: event.userId, alertEventId: event.id, channel, status: "success", provider: "in_app", sentAt: new Date() },
        });
        successes.push(channel);
      } else if (channel === "email") {
        if (preferences && !preferences.emailAlertsEnabled) throw new Error("Email alerts are disabled");
        if (preferences?.quietHoursEnabled && inQuietHours(preferences.quietHoursStart, preferences.quietHoursEnd)) {
          throw new Error("Email delivery skipped during quiet hours");
        }
        const recipient = preferences?.alertEmail || user?.email;
        if (!recipient) throw new Error("No alert email is configured");
        const delivery = await sendEmailNotification({
          to: recipient,
          subject: event.eventTitle,
          text: event.eventMessage,
        });
        await prisma.alertDeliveryLog.create({
          data: { userId: event.userId, alertEventId: event.id, channel, status: "success", provider: delivery.provider, sentAt: new Date() },
        });
        successes.push(channel);
      } else {
        throw new Error("SMS delivery is reserved for a future configured provider");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Notification delivery failed";
      await prisma.alertDeliveryLog.create({
        data: {
          userId: event.userId,
          alertEventId: event.id,
          channel,
          status: "failed",
          provider: channel === "sms_future" ? "twilio_future" : channel === "email" ? "email" : "in_app",
          errorMessage: message,
        },
      });
      failures.push(channel);
    }
  }

  const deliveryStatus = failures.length ? (successes.length ? "partial" : "failed") : "sent";
  await prisma.alertEvent.update({ where: { id: event.id }, data: { deliveryStatus } });
  return { deliveryStatus, successes, failures };
}

export async function markAlertChecked(ruleId: string, checkedAt = new Date()) {
  return prisma.alertRule.update({ where: { id: ruleId }, data: { lastCheckedAt: checkedAt } });
}

async function evaluateRules(userId?: string) {
  const now = new Date();
  const rules = (await prisma.alertRule.findMany({ where: { status: "active", userId } }))
    .filter((rule) => isAlertCategoryEnabled(rule.assetCategory));
  if (rules.some((rule) => rule.assetCategory === "market_index")) {
    await getMarketIndexes(true).catch(() => []);
  }

  const summary = { checked: 0, triggered: 0, skippedCooldown: 0, failed: 0 };
  for (const rule of rules) {
    try {
      if (shouldSkipDueToCooldown(rule, now)) {
        await markAlertChecked(rule.id, now);
        summary.skippedCooldown += 1;
        continue;
      }

      const result = await evaluateRule(rule, now);
      summary.checked += 1;
      if (!result.triggered) {
        await markAlertChecked(rule.id, now);
        continue;
      }

      const event = await createAlertEvent(rule, result);
      await sendAlertNotifications(event);
      const recurring = rule.recurrence !== "none";
      const isDateRule = ["payment_due", "rent_due", "custom_date_reminder", "credit_card_payment_due"].includes(rule.alertType);
      const nextDueDate = recurring && isDateRule && rule.dueDate ? calculateNextDueDate(rule.dueDate, rule.recurrence) : undefined;
      await prisma.alertRule.update({
        where: { id: rule.id },
        data: {
          lastCheckedAt: now,
          lastTriggeredAt: now,
          status: recurring ? "active" : "triggered",
          dueDate: nextDueDate,
        },
      });
      summary.triggered += 1;
    } catch {
      summary.failed += 1;
      await markAlertChecked(rule.id, now).catch(() => undefined);
    }
  }

  return summary;
}

export async function evaluateAllAlerts() {
  return evaluateRules();
}

export async function evaluateAlertsForUser(userId: string) {
  return evaluateRules(userId);
}
