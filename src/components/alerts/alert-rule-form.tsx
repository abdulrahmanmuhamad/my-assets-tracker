"use client";

import { useMemo, useState } from "react";
import { BellRing, RefreshCcw } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import {
  ALERT_ASSET_CATEGORIES,
  ALERT_TYPE_LABELS,
  CATEGORY_ALERT_TYPES,
  type AlertAssetCategory,
  type AlertType,
} from "@/lib/alerts/constants";
import type { AlertAssetOption, AlertRuleRecord, AlertTarget } from "@/lib/alerts/client-types";
import { cn, titleFromSnake } from "@/lib/utils";
import { isAlertCategoryEnabled } from "@/lib/features";

type FormState = {
  name: string;
  description: string;
  assetCategory: AlertAssetCategory;
  assetId: string;
  symbol: string;
  alertType: AlertType;
  thresholdValue: string;
  thresholdPercent: string;
  baselineValue: string;
  baselineRoi: string;
  dueDate: string;
  remindBeforeDays: string;
  recurrence: string;
  notificationChannels: string[];
  cooldownMinutes: string;
};

function comparisonFor(type: AlertType) {
  if (type.includes("increased")) return "increased_by";
  if (type.includes("decreased")) return "decreased_by";
  if (type.includes("above")) return "above";
  if (type.includes("below")) return "below";
  if (type.includes("due") || type.includes("reminder")) return "before_due_date";
  return "equals";
}

function defaults(target?: AlertTarget | null): FormState {
  const category = target?.assetCategory || "mineral";
  const firstType = CATEGORY_ALERT_TYPES[category][0];
  return {
    name: target ? `${target.label} alert` : "Portfolio alert",
    description: "",
    assetCategory: category,
    assetId: target?.assetId || "",
    symbol: target?.symbol || "",
    alertType: firstType,
    thresholdValue: "",
    thresholdPercent: "",
    baselineValue: target?.baselineValue === null || target?.baselineValue === undefined ? "" : String(target.baselineValue),
    baselineRoi: target?.baselineRoi === null || target?.baselineRoi === undefined ? "" : String(target.baselineRoi),
    dueDate: "",
    remindBeforeDays: "0",
    recurrence: category === "real_estate" || category === "bank_account" ? "monthly" : "none",
    notificationChannels: ["in_app"],
    cooldownMinutes: "60",
  };
}

function fromRule(rule: AlertRuleRecord): FormState {
  return {
    name: rule.name,
    description: rule.description || "",
    assetCategory: rule.assetCategory,
    assetId: rule.assetId || "",
    symbol: rule.symbol || "",
    alertType: rule.alertType,
    thresholdValue: rule.thresholdValue === null || rule.thresholdValue === undefined ? "" : String(rule.thresholdValue),
    thresholdPercent: rule.thresholdPercent === null || rule.thresholdPercent === undefined ? "" : String(rule.thresholdPercent),
    baselineValue: rule.baselineValue === null || rule.baselineValue === undefined ? "" : String(rule.baselineValue),
    baselineRoi: rule.baselineRoi === null || rule.baselineRoi === undefined ? "" : String(rule.baselineRoi),
    dueDate: rule.dueDate?.slice(0, 10) || "",
    remindBeforeDays: String(rule.remindBeforeDays || 0),
    recurrence: rule.recurrence,
    notificationChannels: rule.notificationChannels,
    cooldownMinutes: String(rule.cooldownMinutes),
  };
}

type AlertRuleFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (rule: AlertRuleRecord) => void;
  target?: AlertTarget | null;
  rule?: AlertRuleRecord | null;
  assetOptions?: AlertAssetOption[];
};

export function AlertRuleForm(props: AlertRuleFormProps) {
  if (!props.open) return null;
  const formKey = props.rule?.id || `${props.target?.assetCategory || "new"}:${props.target?.assetId || props.target?.symbol || "global"}`;
  return <AlertRuleFormDialog key={formKey} {...props} />;
}

function AlertRuleFormDialog({
  open,
  onClose,
  onSaved,
  target,
  rule,
  assetOptions = [],
}: AlertRuleFormProps) {
  const [form, setForm] = useState<FormState>(() => (rule ? fromRule(rule) : defaults(target)));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const fixedTarget = Boolean(target);
  const availableCategories = ALERT_ASSET_CATEGORIES.filter(isAlertCategoryEnabled);

  const categoryOptions = useMemo(
    () => assetOptions.filter((option) => option.assetCategory === form.assetCategory),
    [assetOptions, form.assetCategory],
  );
  const percentageThreshold = form.alertType.includes("percent");
  const dueAlert = ["payment_due", "rent_due", "custom_date_reminder", "credit_card_payment_due"].includes(form.alertType);
  const baselineValueNeeded = ["price_increased_by_percent", "price_decreased_by_percent"].includes(form.alertType);
  const baselineRoiNeeded = ["roi_increased_by_percent", "roi_decreased_by_percent"].includes(form.alertType);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectAsset(key: string) {
    const option = assetOptions.find((item) => item.key === key);
    if (!option) return;
    setForm((current) => ({
      ...current,
      assetId: option.assetId || "",
      symbol: option.symbol || "",
      baselineValue: option.baselineValue === null || option.baselineValue === undefined ? "" : String(option.baselineValue),
      baselineRoi: option.baselineRoi === null || option.baselineRoi === undefined ? "" : String(option.baselineRoi),
      name: `${option.label} alert`,
    }));
  }

  function toggleChannel(channel: string) {
    setForm((current) => ({
      ...current,
      notificationChannels: current.notificationChannels.includes(channel)
        ? current.notificationChannels.filter((item) => item !== channel)
        : [...current.notificationChannels, channel],
    }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const payload = {
        ...form,
        comparisonOperator: comparisonFor(form.alertType),
        thresholdValue: form.thresholdValue || undefined,
        thresholdPercent: form.thresholdPercent || undefined,
        baselineValue: form.baselineValue || undefined,
        baselineRoi: form.baselineRoi || undefined,
        dueDate: form.dueDate || undefined,
        remindBeforeDays: form.remindBeforeDays || undefined,
        assetId: form.assetId || undefined,
        symbol: form.symbol || undefined,
        cooldownMinutes: Number(form.cooldownMinutes),
      };
      const response = await fetch(rule ? `/api/alerts/${rule.id}` : "/api/alerts", {
        method: rule ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save alert");
      onSaved(data);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save alert");
    } finally {
      setPending(false);
    }
  }

  const inputClass = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

  return (
    <Modal open={open} onClose={onClose} title={rule ? "Edit alert" : "Create alert"} size="lg">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={save}>
        <div className="md:col-span-2 flex items-start gap-3 border-b border-slate-200 pb-4">
          <BellRing className="mt-0.5 h-5 w-5 text-sky-600" />
          <div>
            <div className="text-sm font-semibold text-slate-950">Notification rule</div>
            <div className="mt-1 text-sm text-slate-500">Choose a measurable condition, delivery channels, recurrence, and cooldown.</div>
          </div>
        </div>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700 md:col-span-2">
          Alert name
          <input className={inputClass} value={form.name} onChange={(event) => update("name", event.target.value)} required />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Asset category
          <select
            className={inputClass}
            value={form.assetCategory}
            disabled={fixedTarget || Boolean(rule)}
            onChange={(event) => {
              const category = event.target.value as AlertAssetCategory;
              setForm({ ...defaults(), assetCategory: category, alertType: CATEGORY_ALERT_TYPES[category][0], name: form.name });
            }}
          >
            {availableCategories.map((category) => <option key={category} value={category}>{titleFromSnake(category)}</option>)}
          </select>
        </label>
        {!fixedTarget && !rule && categoryOptions.length ? (
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Asset or market
            <select className={inputClass} defaultValue="" onChange={(event) => selectAsset(event.target.value)} required>
              <option value="" disabled>Select an asset</option>
              {categoryOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </label>
        ) : (
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Target
            <input className={inputClass} value={target?.label || form.symbol || form.assetId || "Portfolio total"} disabled />
          </label>
        )}
        <label className="grid gap-1.5 text-sm font-medium text-slate-700 md:col-span-2">
          Alert condition
          <select className={inputClass} value={form.alertType} onChange={(event) => update("alertType", event.target.value as AlertType)}>
            {CATEGORY_ALERT_TYPES[form.assetCategory].map((type) => <option key={type} value={type}>{ALERT_TYPE_LABELS[type]}</option>)}
          </select>
        </label>
        {!dueAlert ? (
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            {percentageThreshold ? "Threshold percentage" : "Threshold amount"}
            <input
              className={inputClass}
              type="number"
              step="0.0001"
              value={percentageThreshold ? form.thresholdPercent : form.thresholdValue}
              onChange={(event) => update(percentageThreshold ? "thresholdPercent" : "thresholdValue", event.target.value)}
              required
            />
          </label>
        ) : null}
        {baselineValueNeeded ? (
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Baseline price<input className={inputClass} type="number" step="0.0001" value={form.baselineValue} onChange={(event) => update("baselineValue", event.target.value)} required /></label>
        ) : null}
        {baselineRoiNeeded ? (
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Baseline ROI %<input className={inputClass} type="number" step="0.0001" value={form.baselineRoi} onChange={(event) => update("baselineRoi", event.target.value)} required /></label>
        ) : null}
        {dueAlert ? (
          <>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">Due date<input className={inputClass} type="date" value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} required /></label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">Remind before days<input className={inputClass} type="number" min="0" value={form.remindBeforeDays} onChange={(event) => update("remindBeforeDays", event.target.value)} /></label>
          </>
        ) : null}
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Recurrence
          <select className={inputClass} value={form.recurrence} onChange={(event) => update("recurrence", event.target.value)}>
            {(["none", "daily", "weekly", "monthly", "quarterly", "yearly"] as const).map((item) => <option key={item} value={item}>{titleFromSnake(item)}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          Cooldown minutes
          <input className={inputClass} type="number" min="0" value={form.cooldownMinutes} onChange={(event) => update("cooldownMinutes", event.target.value)} />
        </label>
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-medium text-slate-700">Notification channels</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {[{ key: "in_app", label: "In-app" }, { key: "email", label: "Email" }].map((channel) => (
              <label key={channel.key} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.notificationChannels.includes(channel.key)} onChange={() => toggleChannel(channel.key)} />
                {channel.label}
              </label>
            ))}
            <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-400">
              <input type="checkbox" disabled /> SMS (future)
            </label>
          </div>
        </fieldset>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700 md:col-span-2">
          Description
          <textarea className="min-h-20 rounded-md border border-slate-200 px-3 py-2 text-sm" value={form.description} onChange={(event) => update("description", event.target.value)} />
        </label>
        {error ? <div className="md:col-span-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 md:col-span-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={pending || !form.notificationChannels.length} icon={<RefreshCcw className={cn("h-4 w-4", pending && "animate-spin")} />}>Save Alert</Button>
        </div>
      </form>
    </Modal>
  );
}
