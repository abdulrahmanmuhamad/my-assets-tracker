import type { AlertAssetCategory, AlertType } from "./constants";

export type AlertRuleRecord = {
  id: string;
  name: string;
  description?: string | null;
  assetCategory: AlertAssetCategory;
  assetId?: string | null;
  symbol?: string | null;
  alertType: AlertType;
  comparisonOperator: string;
  thresholdValue?: number | null;
  thresholdPercent?: number | null;
  baselineValue?: number | null;
  baselineRoi?: number | null;
  dueDate?: string | null;
  remindBeforeDays?: number | null;
  recurrence: string;
  notificationChannels: string[];
  status: string;
  lastCheckedAt?: string | null;
  lastTriggeredAt?: string | null;
  cooldownMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export type AlertEventRecord = {
  id: string;
  alertRuleId: string;
  alertName: string;
  assetCategory: AlertAssetCategory;
  assetId?: string | null;
  symbol?: string | null;
  eventTitle: string;
  eventMessage: string;
  triggerValue?: number | null;
  triggerPercent?: number | null;
  thresholdValue?: number | null;
  thresholdPercent?: number | null;
  notificationChannels: string[];
  deliveryStatus: string;
  readAt?: string | null;
  createdAt: string;
};

export type AlertAssetOption = {
  key: string;
  assetCategory: AlertAssetCategory;
  assetId?: string | null;
  symbol?: string | null;
  label: string;
  baselineValue?: number | null;
  baselineRoi?: number | null;
};

export type AlertTarget = Omit<AlertAssetOption, "key">;

export type NotificationPreferencesRecord = {
  id: string;
  emailAlertsEnabled: boolean;
  inAppAlertsEnabled: boolean;
  smsAlertsEnabled: boolean;
  alertEmail?: string | null;
  phoneNumber?: string | null;
  quietHoursEnabled: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
};
