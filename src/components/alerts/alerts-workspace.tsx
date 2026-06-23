"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BellPlus, BellRing, Pause, Pencil, Play, Search, Trash2 } from "lucide-react";
import { AlertRuleForm } from "./alert-rule-form";
import type { AlertAssetOption, AlertRuleRecord } from "@/lib/alerts/client-types";
import { ALERT_ASSET_CATEGORIES, ALERT_TYPE_LABELS } from "@/lib/alerts/constants";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, MetricCard } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/patterns";
import { formatDisplayDate, titleFromSnake } from "@/lib/utils";
import { isAlertCategoryEnabled } from "@/lib/features";

function statusTone(status: string): "positive" | "warning" | "info" | "neutral" {
  if (status === "active") return "positive";
  if (status === "triggered") return "warning";
  if (status === "paused") return "info";
  return "neutral";
}

export function AlertsWorkspace({ initialRules, assetOptions }: { initialRules: AlertRuleRecord[]; assetOptions: AlertAssetOption[] }) {
  const searchParams = useSearchParams();
  const assetIdFilter = searchParams.get("assetId");
  const [rules, setRules] = useState(initialRules);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AlertRuleRecord | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return rules.filter((rule) => {
      const searchable = `${rule.name} ${rule.description || ""} ${rule.symbol || ""} ${rule.assetCategory} ${rule.alertType}`.toLowerCase();
      return (
        (!query || searchable.includes(query)) &&
        (status === "all" || rule.status === status) &&
        (category === "all" || rule.assetCategory === category) &&
        (type === "all" || rule.alertType === type) &&
        (!assetIdFilter || rule.assetId === assetIdFilter)
      );
    });
  }, [rules, search, status, category, type, assetIdFilter]);

  async function changeStatus(rule: AlertRuleRecord, action: "pause" | "resume") {
    setPendingId(rule.id);
    setError("");
    try {
      const response = await fetch(`/api/alerts/${rule.id}/${action}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Could not ${action} alert`);
      setRules((current) => current.map((item) => (item.id === data.id ? data : item)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Alert update failed");
    } finally {
      setPendingId(null);
    }
  }

  async function remove(rule: AlertRuleRecord) {
    if (!window.confirm(`Delete alert “${rule.name}”? Its notification history will also be removed.`)) return;
    setPendingId(rule.id);
    setError("");
    try {
      const response = await fetch(`/api/alerts/${rule.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete alert");
      setRules((current) => current.filter((item) => item.id !== rule.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Alert deletion failed");
    } finally {
      setPendingId(null);
    }
  }

  function saveRule(saved: AlertRuleRecord) {
    setRules((current) => {
      const exists = current.some((rule) => rule.id === saved.id);
      return exists ? current.map((rule) => (rule.id === saved.id ? saved : rule)) : [saved, ...current];
    });
    setEditing(null);
  }

  const inputClass = "h-10 rounded-md border border-slate-200 bg-white px-3 text-sm";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Automation rules"
        title="Alerts"
        subtitle="Monitor prices, values, ROI, market indexes, property payments, and rent collection without notification spam."
        actions={
          <>
            <LinkButton href="/notifications" icon={<BellRing className="h-4 w-4" />}>Notifications</LinkButton>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }} icon={<BellPlus className="h-4 w-4" />}>Add Alert</Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active" value={rules.filter((rule) => rule.status === "active").length} detail="Currently evaluated" tone="positive" />
        <MetricCard label="Triggered" value={rules.filter((rule) => rule.status === "triggered").length} detail="One-time conditions reached" tone="warning" />
        <MetricCard label="Paused" value={rules.filter((rule) => rule.status === "paused").length} detail="Evaluation suspended" tone="info" />
        <MetricCard label="Total rules" value={rules.length} detail={`${rules.filter((rule) => rule.notificationChannels.includes("email")).length} use email`} />
      </div>

      <Card>
        <CardContent className="grid gap-3 lg:grid-cols-[1fr_180px_180px_220px]">
          <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input className="min-w-0 flex-1 outline-none" placeholder="Search alerts" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option><option value="active">Active</option><option value="paused">Paused</option><option value="triggered">Triggered</option><option value="expired">Expired</option>
          </select>
          <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>{ALERT_ASSET_CATEGORIES.map((item) => <option key={item} value={item}>{titleFromSnake(item)}</option>)}
          </select>
          <select className={inputClass} value={type} onChange={(event) => setType(event.target.value)}>
            <option value="all">All alert types</option>{Object.entries(ALERT_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </CardContent>
      </Card>

      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <Card>
        <CardHeader><h2 className="text-base font-semibold text-slate-950">Alert rules</h2></CardHeader>
        <div className="divide-y divide-slate-100">
          {filtered.map((rule) => (
            <div key={rule.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_220px_190px_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate font-semibold text-slate-950">{rule.name}</div>
                  <Badge tone={statusTone(rule.status)}>{titleFromSnake(rule.status)}</Badge>
                  {rule.symbol ? <Badge>{rule.symbol}</Badge> : null}
                </div>
                <div className="mt-1 text-sm text-slate-500">{ALERT_TYPE_LABELS[rule.alertType]} · {titleFromSnake(rule.assetCategory)}</div>
              </div>
              <div className="text-sm text-slate-600">
                <div>{rule.recurrence === "none" ? "One-time" : titleFromSnake(rule.recurrence)}</div>
                <div className="mt-1 text-xs text-slate-400">Cooldown {rule.cooldownMinutes} minutes</div>
              </div>
              <div className="text-sm text-slate-600">
                <div>{rule.lastTriggeredAt ? `Triggered ${formatDisplayDate(rule.lastTriggeredAt)}` : "Not triggered"}</div>
                <div className="mt-1 text-xs text-slate-400">{rule.notificationChannels.map(titleFromSnake).join(", ")}</div>
              </div>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" title={isAlertCategoryEnabled(rule.assetCategory) ? "Edit alert" : "Coming Soon"} aria-label="Edit alert" disabled={!isAlertCategoryEnabled(rule.assetCategory)} onClick={() => { setEditing(rule); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                {rule.status === "active" ? (
                  <Button variant="ghost" size="icon" title="Pause alert" aria-label="Pause alert" disabled={pendingId === rule.id} onClick={() => changeStatus(rule, "pause")}><Pause className="h-4 w-4" /></Button>
                ) : (
                  <Button variant="ghost" size="icon" title="Resume alert" aria-label="Resume alert" disabled={pendingId === rule.id} onClick={() => changeStatus(rule, "resume")}><Play className="h-4 w-4" /></Button>
                )}
                <Button variant="ghost" size="icon" title="Delete alert" aria-label="Delete alert" disabled={pendingId === rule.id} onClick={() => remove(rule)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
              </div>
            </div>
          ))}
          {!filtered.length ? <div className="p-6"><EmptyState title="No alerts found" description="Create an alert or adjust the current filters." actionLabel="Add Alert" onAction={() => setFormOpen(true)} /></div> : null}
        </div>
      </Card>

      <AlertRuleForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} onSaved={saveRule} rule={editing} assetOptions={assetOptions} />
    </div>
  );
}
