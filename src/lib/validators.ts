import { z } from "zod";
import { ALLOWED_FILE_TYPES, FILE_TYPE_OPTIONS } from "./constants";
import {
  ALERT_ASSET_CATEGORIES,
  ALERT_CHANNELS,
  ALERT_COMPARISON_OPERATORS,
  ALERT_RECURRENCES,
  ALERT_TYPES,
} from "./alerts/constants";

const emptyToUndefined = (value: unknown) =>
  value === "" || value === null || value === undefined ? undefined : value;

const dateSchema = z.preprocess((value) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  return value;
}, z.coerce.date());

const optionalDateSchema = z.preprocess(emptyToUndefined, dateSchema.optional());
const optionalText = z.preprocess(emptyToUndefined, z.string().trim().optional());
const money = z.coerce.number().min(0);
const positiveNumber = z.coerce.number().positive();
const optionalMoney = z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional());
const optionalPositive = z.preprocess(emptyToUndefined, z.coerce.number().positive().optional());
const optionalInt = z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).optional());
const booleanish = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

export const monthlyExpensesSchema = z
  .object({
    maintenance: optionalMoney.default(0),
    tax: optionalMoney.default(0),
    insurance: optionalMoney.default(0),
    management: optionalMoney.default(0),
    hoa: optionalMoney.default(0),
    other: optionalMoney.default(0),
  })
  .partial()
  .default({});

export const mineralInputSchema = z.object({
  mineralType: z.string().trim().min(1),
  purchaseDate: dateSchema,
  purchasePrice: money,
  purchaseCurrency: z.string().trim().min(3).max(3).default("USD"),
  quantity: positiveNumber,
  unit: z.string().trim().min(1),
  karat: z.preprocess(emptyToUndefined, z.coerce.number().min(1).max(24).optional()),
  purityPercent: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(100).optional()),
  purchaseLocation: optionalText,
  receiptNumber: optionalText,
  currentPricePerGram: optionalMoney,
  notes: optionalText,
  sortOrder: optionalInt,
});

export const realEstateInputSchema = z.object({
  propertyName: z.string().trim().min(1),
  propertyType: z.string().trim().min(1),
  purchaseDate: dateSchema,
  purchasePrice: money,
  estimatedCurrentPrice: money,
  address: optionalText,
  isPaidOff: booleanish.default(false),
  totalPaymentMonths: optionalInt,
  monthsPaid: optionalInt,
  monthsLeft: optionalInt,
  monthlyPayment: optionalMoney,
  remainingBalance: optionalMoney,
  isRented: booleanish.default(false),
  monthlyRent: optionalMoney,
  rentStartDate: optionalDateSchema,
  monthlyExpenses: monthlyExpensesSchema,
  notes: optionalText,
  sortOrder: optionalInt,
});

export const jewelryInputSchema = z.object({
  jewelryType: z.string().trim().min(1),
  itemName: z.string().trim().min(1),
  purchaseDate: dateSchema,
  purchasePrice: money,
  estimatedPriceNow: optionalMoney,
  weight: positiveNumber,
  unit: z.string().trim().min(1),
  pricePerGram: optionalMoney,
  karat: z.preprocess(emptyToUndefined, z.coerce.number().min(1).max(24).optional()),
  purityPercent: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(100).optional()),
  gemstoneType: optionalText,
  caratWeight: optionalPositive,
  purchaseLocation: optionalText,
  receiptNumber: optionalText,
  notes: optionalText,
  sortOrder: optionalInt,
});

export const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export const fileUploadFieldsSchema = z.object({
  assetType: z.enum(["mineral", "real-estate", "jewelry"]),
  assetId: z.string().min(1),
  fileType: z.enum(FILE_TYPE_OPTIONS),
});

export const settingsSchema = z.object({
  defaultCurrency: z.string().trim().min(3).max(3).default("USD"),
  preferredMineralUnit: z.string().trim().min(1),
  preferredJewelryWeightUnit: z.string().trim().min(1),
  livePriceProvider: z.string().trim().min(1),
  manualPriceOverrides: z.record(z.string(), z.coerce.number().min(0)).default({}),
  dashboardVisibility: z.record(z.string(), z.boolean()).default({}),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  includeLiquidCashInPortfolio: z.boolean().default(false),
  financialValuesHiddenByDefault: z.boolean().default(true),
});

export const brokerageProviderSchema = z.enum(["plaid"]);

export const createLinkTokenSchema = z.object({
  provider: brokerageProviderSchema.default("plaid"),
});

export const exchangePublicTokenSchema = z.object({
  publicToken: z.string().trim().min(1),
});

export const syncBrokerageSchema = z.object({
  connectionId: z.string().trim().min(1).optional(),
});

export const disconnectBrokerageSchema = z.object({
  deleteData: z.boolean().default(false),
});

export const updateBankAccountSchema = z.object({
  includeInLiquidCash: z.boolean(),
});

const alertRuleBaseSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: optionalText,
  assetCategory: z.enum(ALERT_ASSET_CATEGORIES),
  assetId: optionalText,
  symbol: optionalText,
  alertType: z.enum(ALERT_TYPES),
  comparisonOperator: z.enum(ALERT_COMPARISON_OPERATORS),
  thresholdValue: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
  thresholdPercent: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  baselineValue: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
  baselineRoi: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
  dueDate: optionalDateSchema,
  remindBeforeDays: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(365).optional()),
  recurrence: z.enum(ALERT_RECURRENCES).default("none"),
  notificationChannels: z.array(z.enum(ALERT_CHANNELS)).min(1).default(["in_app"]),
  cooldownMinutes: z.coerce.number().int().min(0).max(525_600).default(60),
});

export const alertRuleInputSchema = alertRuleBaseSchema.superRefine((input, context) => {
  const percentageTypes = new Set([
    "roi_above_percent",
    "roi_below_percent",
    "roi_increased_by_percent",
    "roi_decreased_by_percent",
    "price_increased_by_percent",
    "price_decreased_by_percent",
    "daily_change_above_percent",
    "daily_change_below_percent",
  ]);
  const valueTypes = new Set([
    "price_above",
    "price_below",
    "value_above",
    "value_below",
    "unrealized_gain_above",
    "unrealized_gain_below",
    "bank_cash_above",
    "bank_cash_below",
    "bank_debt_above",
    "bank_debt_below",
    "bank_net_cash_below",
    "bank_account_balance_above",
    "bank_account_balance_below",
    "bank_transaction_amount_above",
    "bank_deposit_above",
    "bank_withdrawal_above",
  ]);
  const dueTypes = new Set(["payment_due", "rent_due", "custom_date_reminder", "credit_card_payment_due"]);

  if (percentageTypes.has(input.alertType) && input.thresholdPercent === undefined) {
    context.addIssue({ code: "custom", path: ["thresholdPercent"], message: "Threshold percentage is required" });
  }
  if (valueTypes.has(input.alertType) && input.thresholdValue === undefined) {
    context.addIssue({ code: "custom", path: ["thresholdValue"], message: "Threshold value is required" });
  }
  if (["price_increased_by_percent", "price_decreased_by_percent"].includes(input.alertType) && input.baselineValue === undefined) {
    context.addIssue({ code: "custom", path: ["baselineValue"], message: "Baseline value is required" });
  }
  if (["roi_increased_by_percent", "roi_decreased_by_percent"].includes(input.alertType) && input.baselineRoi === undefined) {
    context.addIssue({ code: "custom", path: ["baselineRoi"], message: "Baseline ROI is required" });
  }
  if (dueTypes.has(input.alertType) && !input.dueDate) {
    context.addIssue({ code: "custom", path: ["dueDate"], message: "Due date is required" });
  }
  if (input.assetCategory === "market_index" && !input.symbol) {
    context.addIssue({ code: "custom", path: ["symbol"], message: "Market index symbol is required" });
  }
});

export const notificationPreferencesSchema = z.object({
  emailAlertsEnabled: z.boolean().default(true),
  inAppAlertsEnabled: z.boolean().default(true),
  smsAlertsEnabled: z.boolean().default(false),
  alertEmail: z.preprocess(emptyToUndefined, z.string().email().optional()),
  phoneNumber: optionalText,
  quietHoursEnabled: z.boolean().default(false),
  quietHoursStart: z.preprocess(emptyToUndefined, z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional()),
  quietHoursEnd: z.preprocess(emptyToUndefined, z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional()),
});

export const marketIndexRefreshSchema = z.object({
  symbols: z.array(z.string().trim().min(1)).optional(),
});

export function validateMimeType(mimeType: string) {
  return ALLOWED_FILE_TYPES.includes(mimeType as (typeof ALLOWED_FILE_TYPES)[number]);
}

export function zodErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");
  }

  return error instanceof Error ? error.message : "Unexpected error";
}

export type MineralInput = z.infer<typeof mineralInputSchema>;
export type RealEstateInput = z.infer<typeof realEstateInputSchema>;
export type JewelryInput = z.infer<typeof jewelryInputSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type CreateLinkTokenInput = z.infer<typeof createLinkTokenSchema>;
export type ExchangePublicTokenInput = z.infer<typeof exchangePublicTokenSchema>;
export type SyncBrokerageInput = z.infer<typeof syncBrokerageSchema>;
export type AlertRuleInput = z.infer<typeof alertRuleInputSchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
