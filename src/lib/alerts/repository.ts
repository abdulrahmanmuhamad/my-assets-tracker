import "server-only";
import type { AlertEvent, AlertRule, NotificationPreference, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/calculations";
import type { AlertRuleInput, NotificationPreferencesInput } from "@/lib/validators";
import { DEFAULT_MARKET_INDEXES } from "@/lib/market-data/index-prices";
import type { AlertAssetCategory, AlertType } from "@/lib/alerts/constants";
import { alertOwnershipWhere, notificationOwnershipWhere, notificationReadUpdate } from "@/lib/alerts/access";
import { isAlertCategoryEnabled } from "@/lib/features";

function jsonChannels(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function serializeAlertRule(rule: AlertRule) {
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    assetCategory: rule.assetCategory as AlertAssetCategory,
    assetId: rule.assetId,
    symbol: rule.symbol,
    alertType: rule.alertType as AlertType,
    comparisonOperator: rule.comparisonOperator,
    thresholdValue: rule.thresholdValue === null ? null : toNumber(rule.thresholdValue),
    thresholdPercent: rule.thresholdPercent === null ? null : toNumber(rule.thresholdPercent),
    baselineValue: rule.baselineValue === null ? null : toNumber(rule.baselineValue),
    baselineRoi: rule.baselineRoi === null ? null : toNumber(rule.baselineRoi),
    dueDate: rule.dueDate?.toISOString() || null,
    remindBeforeDays: rule.remindBeforeDays,
    recurrence: rule.recurrence,
    notificationChannels: jsonChannels(rule.notificationChannels),
    status: rule.status,
    lastCheckedAt: rule.lastCheckedAt?.toISOString() || null,
    lastTriggeredAt: rule.lastTriggeredAt?.toISOString() || null,
    cooldownMinutes: rule.cooldownMinutes,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export function serializeAlertEvent(event: AlertEvent & { alertRule?: { name: string } | null }) {
  return {
    id: event.id,
    alertRuleId: event.alertRuleId,
    alertName: event.alertRule?.name || "Alert",
    assetCategory: event.assetCategory as AlertAssetCategory,
    assetId: event.assetId,
    symbol: event.symbol,
    eventTitle: event.eventTitle,
    eventMessage: event.eventMessage,
    triggerValue: event.triggerValue === null ? null : toNumber(event.triggerValue),
    triggerPercent: event.triggerPercent === null ? null : toNumber(event.triggerPercent),
    thresholdValue: event.thresholdValue === null ? null : toNumber(event.thresholdValue),
    thresholdPercent: event.thresholdPercent === null ? null : toNumber(event.thresholdPercent),
    notificationChannels: jsonChannels(event.notificationChannels),
    deliveryStatus: event.deliveryStatus,
    readAt: event.readAt?.toISOString() || null,
    createdAt: event.createdAt.toISOString(),
  };
}

function serializePreferences(preferences: NotificationPreference) {
  return {
    id: preferences.id,
    emailAlertsEnabled: preferences.emailAlertsEnabled,
    inAppAlertsEnabled: preferences.inAppAlertsEnabled,
    smsAlertsEnabled: preferences.smsAlertsEnabled,
    alertEmail: preferences.alertEmail,
    phoneNumber: preferences.phoneNumber,
    quietHoursEnabled: preferences.quietHoursEnabled,
    quietHoursStart: preferences.quietHoursStart,
    quietHoursEnd: preferences.quietHoursEnd,
  };
}

export async function assertAlertAssetOwnership(
  userId: string,
  assetCategory: string,
  assetId?: string | null,
  symbol?: string | null,
) {
  if (assetCategory === "market_index") {
    if (!symbol || !DEFAULT_MARKET_INDEXES.some((index) => index.symbol === symbol)) {
      throw new Error("Unsupported market index symbol");
    }
    return;
  }

  if (!assetId) return;

  const owned =
    assetCategory === "mineral"
      ? await prisma.mineralTransaction.count({ where: { id: assetId, userId } })
      : assetCategory === "jewelry"
        ? await prisma.jewelryItem.count({ where: { id: assetId, userId } })
        : assetCategory === "real_estate"
          ? await prisma.realEstateProperty.count({ where: { id: assetId, userId } })
          : assetCategory === "stock"
            ? symbol === "__ACCOUNT__"
              ? await prisma.brokerageAccount.count({ where: { id: assetId, userId } })
              : await prisma.stockHolding.count({ where: { id: assetId, userId } })
            : 0;

  if (!owned) throw new Error("Alert asset not found");
}

function ruleData(input: AlertRuleInput) {
  return {
    name: input.name,
    description: input.description,
    assetCategory: input.assetCategory,
    assetId: input.assetId,
    symbol: input.symbol?.toUpperCase(),
    alertType: input.alertType,
    comparisonOperator: input.comparisonOperator,
    thresholdValue: input.thresholdValue,
    thresholdPercent: input.thresholdPercent,
    baselineValue: input.baselineValue,
    baselineRoi: input.baselineRoi,
    dueDate: input.dueDate,
    remindBeforeDays: input.remindBeforeDays,
    recurrence: input.recurrence,
    notificationChannels: input.notificationChannels as Prisma.InputJsonValue,
    cooldownMinutes: input.cooldownMinutes,
  };
}

export async function listAlertRules(
  userId: string,
  filters: { status?: string; assetCategory?: string; alertType?: string; assetId?: string } = {},
) {
  const rules = await prisma.alertRule.findMany({
    where: {
      userId,
      status: filters.status,
      assetCategory: filters.assetCategory,
      alertType: filters.alertType,
      assetId: filters.assetId,
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return rules.map(serializeAlertRule);
}

export async function getAlertRule(userId: string, id: string) {
  const rule = await prisma.alertRule.findFirst({ where: alertOwnershipWhere(userId, id) });
  return rule ? serializeAlertRule(rule) : null;
}

export async function createAlertRule(userId: string, input: AlertRuleInput) {
  await assertAlertAssetOwnership(userId, input.assetCategory, input.assetId, input.symbol);
  const created = await prisma.alertRule.create({ data: { userId, ...ruleData(input) } });
  return serializeAlertRule(created);
}

export async function updateAlertRule(userId: string, id: string, input: AlertRuleInput) {
  const existing = await prisma.alertRule.findFirst({ where: alertOwnershipWhere(userId, id) });
  if (!existing) throw new Error("Alert rule not found");
  await assertAlertAssetOwnership(userId, input.assetCategory, input.assetId, input.symbol);
  const updated = await prisma.alertRule.update({ where: { id: existing.id }, data: ruleData(input) });
  return serializeAlertRule(updated);
}

export async function deleteAlertRule(userId: string, id: string) {
  const existing = await prisma.alertRule.findFirst({ where: alertOwnershipWhere(userId, id) });
  if (!existing) throw new Error("Alert rule not found");
  await prisma.alertRule.delete({ where: { id: existing.id } });
}

export async function setAlertRuleStatus(userId: string, id: string, status: "active" | "paused") {
  const existing = await prisma.alertRule.findFirst({ where: alertOwnershipWhere(userId, id) });
  if (!existing) throw new Error("Alert rule not found");
  const updated = await prisma.alertRule.update({ where: { id: existing.id }, data: { status } });
  return serializeAlertRule(updated);
}

export async function listNotifications(userId: string, unreadOnly = false) {
  const events = await prisma.alertEvent.findMany({
    where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
    include: { alertRule: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
  return events.map(serializeAlertEvent);
}

export async function markNotificationRead(userId: string, id: string) {
  const existing = await prisma.alertEvent.findFirst({ where: notificationOwnershipWhere(userId, id) });
  if (!existing) throw new Error("Notification not found");
  const updated = await prisma.alertEvent.update({
    where: { id: existing.id },
    data: notificationReadUpdate(existing.readAt),
    include: { alertRule: { select: { name: true } } },
  });
  return serializeAlertEvent(updated);
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.alertEvent.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  return result.count;
}

export async function deleteNotification(userId: string, id: string) {
  const existing = await prisma.alertEvent.findFirst({ where: notificationOwnershipWhere(userId, id) });
  if (!existing) throw new Error("Notification not found");
  await prisma.alertEvent.delete({ where: { id: existing.id } });
}

export async function getNotificationPreferences(userId: string, email?: string | null, phone?: string | null) {
  const existing = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (existing) return serializePreferences(existing);
  const created = await prisma.notificationPreference.create({
    data: { userId, alertEmail: email || undefined, phoneNumber: phone || undefined },
  });
  return serializePreferences(created);
}

export async function updateNotificationPreferences(userId: string, input: NotificationPreferencesInput) {
  const updated = await prisma.notificationPreference.upsert({
    where: { userId },
    update: input,
    create: { userId, ...input },
  });
  return serializePreferences(updated);
}

export async function getAlertDashboardSummary(userId: string) {
  const now = new Date();
  const soon = new Date(now);
  soon.setUTCDate(soon.getUTCDate() + 30);

  const disabledCategories = ["stock", "bank", "bank_account", "bank_transaction"].filter((category) => !isAlertCategoryEnabled(category));
  const enabledCategoryWhere = disabledCategories.length ? { assetCategory: { notIn: disabledCategories } } : {};
  const [activeAlerts, triggeredAlerts, unreadNotifications, recentEvents, upcomingPayments, upcomingRent] = await Promise.all([
    prisma.alertRule.count({ where: { userId, status: "active", ...enabledCategoryWhere } }),
    prisma.alertRule.count({ where: { userId, status: "triggered", ...enabledCategoryWhere } }),
    prisma.alertEvent.count({ where: { userId, readAt: null } }),
    prisma.alertEvent.findMany({
      where: { userId },
      include: { alertRule: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.alertRule.findMany({
      where: { userId, status: "active", alertType: "payment_due", dueDate: { gte: now, lte: soon } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.alertRule.findMany({
      where: { userId, status: "active", alertType: "rent_due", dueDate: { gte: now, lte: soon } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
  ]);

  return {
    activeAlerts,
    triggeredAlerts,
    unreadNotifications,
    recentEvents: recentEvents.map(serializeAlertEvent),
    upcomingPayments: upcomingPayments.map(serializeAlertRule),
    upcomingRent: upcomingRent.map(serializeAlertRule),
  };
}
