"use client";

import { useState } from "react";
import { Download, EyeOff, MonitorCog, Phone, RefreshCcw, Save, ShieldCheck, Trash2, Upload, WalletCards } from "lucide-react";
import { UserProfile } from "@clerk/nextjs";
import { ClerkSecurityActions } from "@/components/settings/clerk-security-actions";
import type { NotificationPreferencesRecord } from "@/lib/alerts/client-types";
import type { SettingsRecord } from "@/lib/data";
import { Button, LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/patterns";
import { JEWELRY_UNITS, WEIGHT_UNITS } from "@/lib/constants";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { UserAccessSettings } from "@/components/settings/user-access-settings";
import { DeveloperSetup, type DeveloperReadiness } from "@/components/settings/developer-setup";
import { isBanksFeatureEnabled, isStocksFeatureEnabled } from "@/lib/features";

const metalOverrideLabels: Record<string, string> = {
  XAU: "Gold",
  XAG: "Silver",
  XPT: "Platinum",
  XPD: "Palladium",
  XCU: "Copper",
};

type SecurityUser = {
  email: string | null;
  phone: string | null;
  name: string | null;
  imageUrl: string | null;
  username: string | null;
  displayName: string | null;
  emailVerified: boolean;
  accessStatus: string;
  role: string;
};

type BrokerageConnection = {
  id: string;
  provider: string;
  institutionName: string;
  status: string;
  lastSyncedAt?: string | null;
};

export function SettingsPanel({
  initialSettings,
  securityUser,
  initialBrokerageConnections,
  initialNotificationPreferences,
  developerReadiness,
}: {
  initialSettings: SettingsRecord;
  securityUser: SecurityUser;
  initialBrokerageConnections: BrokerageConnection[];
  initialNotificationPreferences: NotificationPreferencesRecord;
  developerReadiness?: DeveloperReadiness;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [brokerageConnections, setBrokerageConnections] = useState(initialBrokerageConnections);
  const [notificationPreferences, setNotificationPreferences] = useState(initialNotificationPreferences);
  const [phone, setPhone] = useState(securityUser.phone || "");
  const [phonePending, setPhonePending] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("profile");
  const ownerOnly = securityUser.role === "owner";
  const stocksEnabled = isStocksFeatureEnabled();
  const banksEnabled = isBanksFeatureEnabled();
  const tabs = [
    ["profile", "Profile"],
    ["security", "Security"],
    ["privacy", "Privacy & Display"],
    ["notifications", "Notifications"],
    ["portfolio", "Portfolio Settings"],
    ...(ownerOnly ? [["integrations", "Integrations"], ["access", "User Access"], ["developer", "Developer / API Setup"]] : []),
  ];

  function update<K extends keyof SettingsRecord>(key: K, value: SettingsRecord[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function updateOverride(symbol: string, value: string) {
    setSettings((current) => ({
      ...current,
      manualPriceOverrides: {
        ...current.manualPriceOverrides,
        [symbol]: Number(value),
      },
    }));
  }

  function updateVisibility(key: string, value: boolean) {
    setSettings((current) => ({
      ...current,
      dashboardVisibility: {
        ...current.dashboardVisibility,
        [key]: value,
      },
    }));
  }

  async function save() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Save failed");
      setSettings(data);
      window.dispatchEvent(new CustomEvent("portfolio:settings-updated", { detail: data }));
      const notificationResponse = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationPreferences),
      });
      const notificationData = await notificationResponse.json();
      if (!notificationResponse.ok) throw new Error(notificationData.error || "Notification preferences save failed");
      setNotificationPreferences(notificationData);
      setMessage("Settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  async function refreshPrices() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/prices/refresh", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Refresh failed");
      setMessage(data.warning || "Prices refreshed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Refresh failed");
    } finally {
      setPending(false);
    }
  }

  async function savePhone() {
    setPhonePending(true);
    setPhoneMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Phone update failed");
      setPhone(data.phone || "");
      window.dispatchEvent(new CustomEvent("portfolio:profile-updated", { detail: data }));
      setNotificationPreferences((current) => current.phoneNumber ? current : { ...current, phoneNumber: data.phone || "" });
      setPhoneMessage("Phone number saved.");
    } catch (error) {
      setPhoneMessage(error instanceof Error ? error.message : "Phone update failed");
    } finally {
      setPhonePending(false);
    }
  }

  async function importCsv(file?: File) {
    if (!file) return;
    setPending(true);
    setMessage("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/reports/import/csv", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import failed");
      setMessage(`Imported ${data.imported} rows.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed");
    } finally {
      setPending(false);
    }
  }

  async function disconnectBrokerage(connectionId: string) {
    if (!window.confirm("Disconnect this brokerage account? Provider tokens will be removed from this app.")) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/brokerage/connections/${connectionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteData: false }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Disconnect failed");
      setBrokerageConnections((current) =>
        current.map((connection) => (connection.id === connectionId ? { ...connection, status: data.status } : connection)),
      );
      setMessage("Brokerage disconnected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Disconnect failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        subtitle="Profile, security, privacy, notifications, portfolio preferences, integrations, and controlled user access."
        actions={
          <>
          <Button variant="secondary" onClick={refreshPrices} disabled={pending} icon={<RefreshCcw className="h-4 w-4" />}>
            Refresh Prices
          </Button>
          <Button onClick={save} disabled={pending} icon={<Save className="h-4 w-4" />}>
            Save
          </Button>
          </>
        }
      />

      {message ? <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{message}</div> : null}

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px" role="tablist" aria-label="Settings sections">
        {tabs.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={activeTab === value} onClick={() => setActiveTab(value)} className={activeTab === value ? "shrink-0 border-b-2 border-slate-950 px-3 py-2 text-sm font-semibold text-slate-950" : "shrink-0 border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-900"}>{label}</button>)}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {activeTab === "profile" ? <ProfileSettings initialUser={securityUser} clerkConfigured={Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)} /> : null}
        {activeTab === "access" && ownerOnly ? <UserAccessSettings actorRole={securityUser.role} /> : null}
        {activeTab === "developer" && ownerOnly && developerReadiness ? <DeveloperSetup readiness={developerReadiness} /> : null}

        <Card className={activeTab === "security" ? "xl:col-span-2" : "hidden"}>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Security</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Email</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{securityUser.email || "Not set"}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  <Phone className="h-3.5 w-3.5 text-sky-600" />
                  Phone
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <label className="min-w-0">
                    <span className="sr-only">Phone number</span>
                    <input
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+1 555 123 4567"
                      maxLength={30}
                    />
                  </label>
                  <Button className="w-full sm:w-auto" size="sm" variant="secondary" onClick={savePhone} disabled={phonePending} icon={<Save className="h-4 w-4" />}>
                    {phonePending ? "Saving..." : "Save"}
                  </Button>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">Used for your profile and future notification preferences. Email remains managed by Clerk.</p>
                {phoneMessage ? <div className="mt-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">{phoneMessage}</div> : null}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">MFA</div>
                <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Managed by Clerk
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Session</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">HTTP-only Clerk session</div>
              </div>
            </div>
            {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
              <>
                <ClerkSecurityActions />
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2">
                  <UserProfile routing="hash" />
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Clerk keys are not configured in this local environment.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={activeTab === "notifications" ? "xl:col-span-2" : "hidden"}>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Notification Preferences</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
              In-app alerts
              <input className="h-5 w-5" type="checkbox" checked={notificationPreferences.inAppAlertsEnabled} onChange={(event) => setNotificationPreferences((current) => ({ ...current, inAppAlertsEnabled: event.target.checked }))} />
            </label>
            <label className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
              Email alerts
              <input className="h-5 w-5" type="checkbox" checked={notificationPreferences.emailAlertsEnabled} onChange={(event) => setNotificationPreferences((current) => ({ ...current, emailAlertsEnabled: event.target.checked }))} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-700">
              Alert email
              <input className="h-10 rounded-md border border-slate-200 px-3 text-sm" type="email" value={notificationPreferences.alertEmail || ""} onChange={(event) => setNotificationPreferences((current) => ({ ...current, alertEmail: event.target.value }))} placeholder={securityUser.email || "alerts@example.com"} />
            </label>
            <label className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
              Quiet hours (UTC)
              <input className="h-5 w-5" type="checkbox" checked={notificationPreferences.quietHoursEnabled} onChange={(event) => setNotificationPreferences((current) => ({ ...current, quietHoursEnabled: event.target.checked }))} />
            </label>
            {notificationPreferences.quietHoursEnabled ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">Start<input className="h-10 rounded-md border border-slate-200 px-3 text-sm" type="time" value={notificationPreferences.quietHoursStart || "22:00"} onChange={(event) => setNotificationPreferences((current) => ({ ...current, quietHoursStart: event.target.value }))} /></label>
                <label className="grid gap-1.5 text-sm font-medium text-slate-700">End<input className="h-10 rounded-md border border-slate-200 px-3 text-sm" type="time" value={notificationPreferences.quietHoursEnd || "07:00"} onChange={(event) => setNotificationPreferences((current) => ({ ...current, quietHoursEnd: event.target.value }))} /></label>
              </div>
            ) : null}
            <label className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-400">
              SMS alerts (future provider)
              <input className="h-5 w-5" type="checkbox" checked={false} disabled />
            </label>
          </CardContent>
        </Card>

        <Card className={activeTab === "privacy" ? "xl:col-span-2" : "hidden"}>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Privacy & Display</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between gap-4 rounded-md border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700">
              <span className="flex items-center gap-3"><EyeOff className="h-4 w-4 text-sky-600" />Hide financial values by default</span>
              <input className="h-5 w-5" type="checkbox" checked={settings.financialValuesHiddenByDefault} onChange={(event) => update("financialValuesHiddenByDefault", event.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-md border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700">
              <span className="flex items-center gap-3"><WalletCards className="h-4 w-4 text-emerald-600" />Include liquid cash in portfolio total</span>
              <input className="h-5 w-5" type="checkbox" checked={banksEnabled && settings.includeLiquidCashInPortfolio} disabled={!banksEnabled} onChange={(event) => update("includeLiquidCashInPortfolio", event.target.checked)} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              <span className="flex items-center gap-3"><MonitorCog className="h-4 w-4 text-violet-600" />Theme</span>
              <select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={settings.theme} onChange={(event) => update("theme", event.target.value)}>
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <p className="text-xs leading-5 text-slate-500">Temporary reveal controls reset on reload. Credit-card debt is never added to portfolio value.</p>
          </CardContent>
        </Card>

        <Card className={activeTab === "integrations" && ownerOnly ? "xl:col-span-2" : "hidden"}>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Integrations</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-semibold text-slate-950">SnapTrade Personal</div><p className="mt-1 text-xs leading-5 text-slate-500">Read-only brokerage syncing with credentials supplied by each user.</p><Badge tone="positive" className="mt-3">Available</Badge></div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4"><div className="text-sm font-semibold text-slate-950">SimpleFIN Bridge</div><p className="mt-1 text-xs leading-5 text-slate-500">Read-only bank syncing through each user&apos;s SimpleFIN subscription.</p><Badge tone="positive" className="mt-3">Available</Badge></div>
            </div>
            {stocksEnabled ? brokerageConnections.map((connection) => (
              <div key={connection.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-950">{connection.institutionName}</div>
                  <div className="mt-1 text-xs text-slate-500">{connection.provider}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={connection.status === "active" ? "positive" : connection.status === "disconnected" ? "neutral" : "warning"}>
                    {connection.status}
                  </Badge>
                  <Button
                    variant="danger"
                    size="icon"
                    title="Disconnect brokerage"
                    aria-label="Disconnect brokerage"
                    disabled={pending || connection.status === "disconnected"}
                    onClick={() => disconnectBrokerage(connection.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )) : null}
            {stocksEnabled && !brokerageConnections.length ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                No brokerage accounts connected.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className={activeTab === "portfolio" ? "" : "hidden"}>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Preferences</h2>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Default currency
                <input className="h-10 rounded-md border border-slate-200 px-3 text-sm" value={settings.defaultCurrency} onChange={(event) => update("defaultCurrency", event.target.value.toUpperCase())} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Preferred mineral unit
                <select className="h-10 rounded-md border border-slate-200 px-3 text-sm" value={settings.preferredMineralUnit} onChange={(event) => update("preferredMineralUnit", event.target.value)}>
                  {WEIGHT_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Preferred jewelry unit
                <select className="h-10 rounded-md border border-slate-200 px-3 text-sm" value={settings.preferredJewelryWeightUnit} onChange={(event) => update("preferredJewelryWeightUnit", event.target.value)}>
                  {JEWELRY_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className={activeTab === "portfolio" ? "" : "hidden"}>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Live Price Provider</h2>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                Provider
                <select className="h-10 rounded-md border border-slate-200 px-3 text-sm" value={settings.livePriceProvider} onChange={(event) => update("livePriceProvider", event.target.value)}>
                  <option value="yahoo">Daily market data</option>
                  <option value="manual">Manual</option>
                  <option value="goldapi">GoldAPI.io</option>
                  <option value="metals-api">Metals-API</option>
                </select>
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                {["XAU", "XAG", "XPT", "XPD", "XCU"].map((symbol) => (
                  <label key={symbol} className="grid gap-1.5 text-sm font-medium text-slate-700">
                    {metalOverrideLabels[symbol]} override / gram
                    <input
                      className="h-10 rounded-md border border-slate-200 px-3 text-sm"
                      type="number"
                      step="0.000001"
                      value={settings.manualPriceOverrides[symbol] ?? 0}
                      onChange={(event) => updateOverride(symbol, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={activeTab === "portfolio" ? "" : "hidden"}>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Dashboard Visibility</h2>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {[
                ["allocationByCategory", "Allocation by category"],
                ["allocationBySubtype", "Allocation by sub-type"],
                ["realEstateCashFlow", "Real estate cash flow"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                  {label}
                  <input
                    className="h-5 w-5 rounded border-slate-300"
                    type="checkbox"
                    checked={settings.dashboardVisibility[key] ?? true}
                    onChange={(event) => updateVisibility(key, event.target.checked)}
                  />
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={activeTab === "portfolio" ? "" : "hidden"}>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Data</h2>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <LinkButton href="/api/reports/export/csv" icon={<Download className="h-4 w-4" />}>
                Export CSV
              </LinkButton>
              <LinkButton href="/api/reports/export/pdf" icon={<Download className="h-4 w-4" />}>
                Export PDF
              </LinkButton>
              <LinkButton href="/api/reports/portfolio" icon={<Download className="h-4 w-4" />}>
                Backup JSON
              </LinkButton>
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50">
                <Upload className="h-4 w-4" />
                Import CSV
                <input className="hidden" type="file" accept=".csv,text/csv" onChange={(event) => importCsv(event.target.files?.[0])} />
              </label>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
