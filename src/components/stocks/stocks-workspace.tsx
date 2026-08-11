"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BellPlus, BellRing, Building2, ExternalLink, KeyRound, Link2, RefreshCcw, ShieldCheck, Trash2 } from "lucide-react";
import { AlertRuleForm } from "@/components/alerts/alert-rule-form";
import type { AlertRuleRecord, AlertTarget } from "@/lib/alerts/client-types";
import { AllocationLegend, AllocationPie } from "@/components/charts/allocation-pie";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, MetricCard } from "@/components/ui/card";
import { EmptyState, PageHeader, RoiBadge } from "@/components/ui/patterns";
import { Modal } from "@/components/ui/modal";
import { cn, formatCurrency, formatDisplayDate, formatPercent } from "@/lib/utils";
import { SensitiveCurrency, SensitiveNumber } from "@/components/privacy/sensitive-value";

type StockConnection = {
  id: string;
  provider: string;
  institutionName: string;
  institutionLogoUrl?: string | null;
  status: string;
  lastSyncedAt?: string | null;
};

type StockAccount = {
  id: string;
  brokerageConnectionId: string;
  brokerName: string;
  accountName: string;
  accountType: string;
  accountSubtype?: string | null;
  mask?: string | null;
  currency: string;
  currentBalance?: number | null;
  availableBalance?: number | null;
  officialName?: string | null;
};

type StockHolding = {
  id: string;
  brokerageAccountId: string;
  brokerageConnectionId: string;
  symbol?: string | null;
  securityName: string;
  securityType: string;
  quantity: number;
  costBasis?: number | null;
  averageCost?: number | null;
  currentPrice?: number | null;
  marketValue: number;
  unrealizedGainLoss?: number | null;
  unrealizedGainLossPercent?: number | null;
  currency: string;
  asOfDate: string;
  accountName: string;
  brokerName: string;
};

type StockTransaction = {
  id: string;
  brokerageAccountId: string;
  brokerageConnectionId: string;
  symbol?: string | null;
  securityName?: string | null;
  transactionType: string;
  quantity?: number | null;
  price?: number | null;
  amount: number;
  fees?: number | null;
  date: string;
  currency: string;
  accountName: string;
  brokerName: string;
};

type Allocation = {
  name: string;
  value: number;
  percentOfTotal: number;
  roiPercent?: number | null;
};

type StocksPortfolio = {
  connections: StockConnection[];
  accounts: StockAccount[];
  holdings: StockHolding[];
  transactions: StockTransaction[];
  summary: {
    totalValue: number;
    totalCostBasis: number;
    totalGainLoss: number | null;
    totalROI: number | null;
    costBasisMissingCount: number;
    allocationByBroker: Allocation[];
    allocationBySymbol: Allocation[];
    allocationByAccount: Allocation[];
  };
};

function nullableCurrency(value: number | null | undefined) {
  return value === null || value === undefined ? "N/A" : formatCurrency(value);
}

function nullablePercent(value: number | null | undefined) {
  return value === null || value === undefined ? "N/A" : formatPercent(value);
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone = normalized === "active" ? "positive" : normalized === "disconnected" ? "neutral" : "warning";
  const label =
    normalized === "requires_reauth"
      ? "Re-auth required"
      : normalized === "error"
        ? "Sync failed"
        : normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return <Badge tone={tone}>{label}</Badge>;
}

function StockRoiBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <Badge tone="neutral">N/A</Badge>;
  return <RoiBadge value={value} />;
}

export function StocksWorkspace({ initialPortfolio }: { initialPortfolio: StocksPortfolio }) {
  const [portfolio, setPortfolio] = useState(initialPortfolio);
  const [activeConnectionId, setActiveConnectionId] = useState(initialPortfolio.connections[0]?.id || "all");
  const [connectOpen, setConnectOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [consumerKey, setConsumerKey] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alertTarget, setAlertTarget] = useState<AlertTarget | null>(null);
  const [alertRules, setAlertRules] = useState<AlertRuleRecord[]>([]);
  const finalizedRedirect = useRef(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/stocks", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not refresh stocks data");
    const next = await response.json();
    setPortfolio(next);
    setActiveConnectionId((current) => next.connections.some((connection: StockConnection) => connection.id === current) ? current : next.connections[0]?.id || "all");
  }, []);

  useEffect(() => {
    if (finalizedRedirect.current) return;
    const params = new URL(window.location.href).searchParams;
    const status = params.get("status");
    if (!status) return;
    finalizedRedirect.current = true;
    window.history.replaceState({}, "", "/stocks");
    if (status !== "SUCCESS") {
      if (status === "ERROR") {
        queueMicrotask(() => setError("SnapTrade could not complete the brokerage connection. Please try again."));
      }
      return;
    }
    queueMicrotask(() => {
      setPending(true);
      fetch("/api/brokerage/snaptrade/finalize", { method: "POST" })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "Could not synchronize SnapTrade accounts");
          await refresh();
        })
        .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not synchronize SnapTrade accounts"))
        .finally(() => setPending(false));
    });
  }, [refresh]);

  useEffect(() => {
    fetch("/api/alerts?assetCategory=stock", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((rules) => setAlertRules(Array.isArray(rules) ? rules : []))
      .catch(() => setAlertRules([]));
  }, []);

  function openHoldingAlert(holding: StockHolding) {
    setAlertTarget({
      assetCategory: "stock",
      assetId: holding.id,
      symbol: holding.symbol,
      label: holding.symbol || holding.securityName,
      baselineValue: holding.currentPrice,
      baselineRoi: holding.unrealizedGainLossPercent,
    });
  }

  async function startSnapTradePortal(body: { clientId?: string; consumerKey?: string; connectionId?: string }) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/brokerage/snaptrade/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not start brokerage linking");
      window.location.assign(payload.redirectUri);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start brokerage linking");
      setPending(false);
      return false;
    }
  }

  function connectBrokerage(connectionId?: string) {
    if (connectionId || portfolio.connections.some((connection) => connection.provider === "snaptrade" && connection.status !== "disconnected")) {
      void startSnapTradePortal(connectionId ? { connectionId } : {});
      return;
    }
    setError(null);
    setConnectOpen(true);
  }

  async function submitSnapTrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const started = await startSnapTradePortal({ clientId, consumerKey });
    if (started) {
      setClientId("");
      setConsumerKey("");
    }
  }

  async function sync(connectionId?: string) {
    setPending(true);
    setError(null);
    try {
      const endpoint = connectionId ? `/api/brokerage/sync/${connectionId}` : "/api/brokerage/sync";
      const response = await fetch(endpoint, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not sync brokerage data");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sync brokerage data");
    } finally {
      setPending(false);
    }
  }

  async function disconnect(connectionId: string) {
    if (!window.confirm("Disconnect this brokerage and remove its imported accounts, holdings, and transactions from this portfolio?")) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/brokerage/connections/${connectionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteData: true }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not disconnect brokerage");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not disconnect brokerage");
    } finally {
      setPending(false);
    }
  }

  const activeConnections = portfolio.connections.filter((connection) => connection.status !== "disconnected");
  const selectedConnection = activeConnectionId === "all" ? null : portfolio.connections.find((connection) => connection.id === activeConnectionId);
  const scopedAccounts = selectedConnection
    ? portfolio.accounts.filter((account) => account.brokerageConnectionId === selectedConnection.id)
    : portfolio.accounts;
  const scopedHoldings = selectedConnection
    ? portfolio.holdings.filter((holding) => holding.brokerageConnectionId === selectedConnection.id)
    : portfolio.holdings;
  const scopedTransactions = selectedConnection
    ? portfolio.transactions.filter((transaction) => transaction.brokerageConnectionId === selectedConnection.id)
    : portfolio.transactions;

  const scopedTotalValue = scopedHoldings.reduce((sum, holding) => sum + holding.marketValue, 0);
  const scopedCostBasis = scopedHoldings.reduce((sum, holding) => sum + (holding.costBasis || 0), 0);
  const scopedGainLoss = scopedTotalValue - scopedCostBasis;
  const scopedRoi = scopedCostBasis > 0 ? (scopedGainLoss / scopedCostBasis) * 100 : null;
  const cashBalance = scopedAccounts.reduce((sum, account) => sum + (account.availableBalance || 0), 0);
  const topHoldings = useMemo(() => scopedHoldings.slice().sort((a, b) => b.marketValue - a.marketValue).slice(0, 8), [scopedHoldings]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Brokerage ledger"
        title="Stocks"
        subtitle="Track connected brokerage accounts, holdings, balances, cost basis, market value, unrealized gain/loss, ROI, and transactions."
        actions={
          <>
            <LinkButton href="/alerts" variant="secondary" icon={<BellRing className="h-4 w-4" />}>View Alerts</LinkButton>
            <Button variant="secondary" onClick={() => sync()} disabled={pending || !activeConnections.length} icon={<RefreshCcw className={cn("h-4 w-4", pending && "animate-spin")} />}>
              Sync All
            </Button>
            <Button onClick={() => connectBrokerage()} disabled={pending} icon={<Link2 className="h-4 w-4" />}>
              Connect Brokerage
            </Button>
          </>
        }
      />

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {!portfolio.connections.length ? (
        <Card>
          <CardContent className="p-8">
            <EmptyState
              title="Connect your first brokerage account"
              description="Securely connect your brokerage to automatically track holdings, balances, and investment performance. Brokerage credentials are never stored by this app."
              actionLabel="Connect Brokerage"
              onAction={() => connectBrokerage()}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Stock portfolio value" value={formatCurrency(portfolio.summary.totalValue)} detail={`${portfolio.holdings.length} holdings`} tone="info" />
        <MetricCard label="Known cost basis" value={formatCurrency(portfolio.summary.totalCostBasis)} detail={portfolio.summary.costBasisMissingCount ? `${portfolio.summary.costBasisMissingCount} missing` : "Complete"} tone={portfolio.summary.costBasisMissingCount ? "warning" : "positive"} />
        <MetricCard label="Unrealized gain/loss" value={nullableCurrency(portfolio.summary.totalGainLoss)} detail={nullablePercent(portfolio.summary.totalROI)} tone={(portfolio.summary.totalGainLoss || 0) >= 0 ? "positive" : "negative"} />
        <MetricCard label="Cash balance" value={formatCurrency(cashBalance)} detail={`${activeConnections.length} connected brokers`} />
      </div>

      {portfolio.summary.costBasisMissingCount ? (
        <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Some brokerage cost basis data is missing. ROI uses known cost basis only and displays N/A where unavailable.</span>
        </div>
      ) : null}

      {portfolio.connections.length ? (
        <Card>
          <CardContent className="flex gap-2 overflow-x-auto p-3">
            <button
              className={cn(
                "h-10 rounded-xl px-4 text-sm font-semibold transition",
                activeConnectionId === "all" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              )}
              onClick={() => setActiveConnectionId("all")}
            >
              All Brokers
            </button>
            {portfolio.connections.map((connection) => (
              <button
                key={connection.id}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition",
                  activeConnectionId === connection.id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                )}
                onClick={() => setActiveConnectionId(connection.id)}
              >
                {connection.institutionName}
                <StatusBadge status={connection.status} />
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {selectedConnection ? (
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-950">{selectedConnection.institutionName}</h2>
                  <StatusBadge status={selectedConnection.status} />
                </div>
                <div className="text-sm text-slate-500">
                  Last synced {selectedConnection.lastSyncedAt ? formatDisplayDate(selectedConnection.lastSyncedAt) : "not yet"}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => sync(selectedConnection.id)} disabled={pending} icon={<RefreshCcw className="h-4 w-4" />}>
                Sync Broker
              </Button>
              {selectedConnection.provider === "snaptrade" && selectedConnection.status === "requires_reauth" ? (
                <Button variant="secondary" onClick={() => connectBrokerage(selectedConnection.id)} disabled={pending} icon={<KeyRound className="h-4 w-4" />}>
                  Reconnect
                </Button>
              ) : null}
              <Button variant="danger" onClick={() => disconnect(selectedConnection.id)} disabled={pending} icon={<Trash2 className="h-4 w-4" />}>
                Disconnect
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Broker value" value={formatCurrency(scopedTotalValue)} detail={`${scopedAccounts.length} accounts`} tone="info" />
        <MetricCard label="Broker cost basis" value={formatCurrency(scopedCostBasis)} detail={`${scopedHoldings.length} holdings`} />
        <MetricCard label="Broker gain/loss" value={formatCurrency(scopedGainLoss)} detail={nullablePercent(scopedRoi)} tone={scopedGainLoss >= 0 ? "positive" : "negative"} />
        <MetricCard label="Connected brokers" value={activeConnections.length} detail={`${portfolio.accounts.length} total accounts`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Allocation by Broker</h2>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 md:grid-cols-[1fr_240px] md:items-center">
              <AllocationPie data={portfolio.summary.allocationByBroker} />
              <AllocationLegend data={portfolio.summary.allocationByBroker} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Top Holdings</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {topHoldings.map((holding) => (
              <div key={holding.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-950">{holding.symbol || holding.securityName}</div>
                  <div className="truncate text-xs text-slate-500">{holding.securityName}</div>
                </div>
                <div className="text-right">
                  <SensitiveCurrency value={holding.marketValue} className="font-mono text-sm font-semibold text-slate-950" label="holding market value" />
                  <StockRoiBadge value={holding.unrealizedGainLossPercent} />
                </div>
              </div>
            ))}
            {!topHoldings.length ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No holdings yet.</div> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {scopedAccounts.map((account) => (
          <Card key={account.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-950">{account.accountName}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {account.accountSubtype || account.accountType}
                    {account.mask ? ` / ${account.mask}` : ""}
                  </div>
                </div>
                <Badge tone="info">{account.currency}</Badge>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Balance</div>
                  <SensitiveCurrency value={account.currentBalance} className="mt-1 font-mono text-lg font-semibold text-slate-950" label="account balance" />
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Cash</div>
                  <SensitiveCurrency value={account.availableBalance} className="mt-1 font-mono text-lg font-semibold text-slate-950" label="available cash" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-950">Holdings</h2>
          <p className="mt-1 text-sm text-slate-500">Cost basis, market value, unrealized gain/loss, ROI, and allocation.</p>
        </CardHeader>
        <div className="hidden overflow-x-auto md:block">
          <table className="financial-table min-w-[1260px] w-full table-fixed text-left text-sm">
            <thead className="bg-slate-50/95 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="w-28 px-3 py-3">Symbol</th>
                <th className="w-60 px-3 py-3">Name</th>
                <th className="w-36 px-3 py-3">Account</th>
                <th className="w-28 px-3 py-3">Quantity</th>
                <th className="w-32 px-3 py-3">Average cost</th>
                <th className="w-32 px-3 py-3">Cost basis</th>
                <th className="w-32 px-3 py-3">Current price</th>
                <th className="w-32 px-3 py-3">Market value</th>
                <th className="w-36 px-3 py-3">Gain/loss</th>
                <th className="w-28 px-3 py-3">ROI</th>
                <th className="w-28 px-3 py-3">As of</th>
                <th className="w-24 px-3 py-3 text-right">Alerts</th>
              </tr>
            </thead>
            <tbody>
              {scopedHoldings.map((holding) => (
                <tr key={holding.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-semibold text-slate-950">{holding.symbol || "N/A"}</td>
                  <td className="px-3 py-3 text-slate-600">{holding.securityName}</td>
                  <td className="px-3 py-3 text-slate-600">{holding.accountName}</td>
                  <td className="px-3 py-3 font-mono text-slate-700"><SensitiveNumber value={holding.quantity} digits={4} kind="shares" label="holding quantity" /></td>
                  <td className="px-3 py-3"><SensitiveCurrency value={holding.averageCost} label="average cost" /></td>
                  <td className="px-3 py-3"><SensitiveCurrency value={holding.costBasis} label="cost basis" /></td>
                  <td className="px-3 py-3"><SensitiveCurrency value={holding.currentPrice} label="current price" /></td>
                  <td className="px-3 py-3 font-semibold text-slate-900"><SensitiveCurrency value={holding.marketValue} label="market value" /></td>
                  <td className={cn("px-3 py-3 font-medium", (holding.unrealizedGainLoss || 0) >= 0 ? "text-emerald-700" : "text-rose-700")}><SensitiveCurrency value={holding.unrealizedGainLoss} label="unrealized gain or loss" /></td>
                  <td className="px-3 py-3"><StockRoiBadge value={holding.unrealizedGainLossPercent} /></td>
                  <td className="px-3 py-3 text-slate-500">{formatDisplayDate(holding.asOfDate)}</td>
                  <td className="px-3 py-3 text-right">
                    <Button variant="ghost" size="icon" title={`Add alert (${alertRules.filter((rule) => rule.assetId === holding.id).length} existing)`} aria-label="Add alert" onClick={() => openHoldingAlert(holding)}>
                      <BellPlus className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 p-4 md:hidden">
          {scopedHoldings.map((holding) => (
            <div key={holding.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{holding.symbol || holding.securityName}</div>
                  <div className="text-sm text-slate-500">{holding.accountName}</div>
                </div>
                <StockRoiBadge value={holding.unrealizedGainLossPercent} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">Value</span><SensitiveCurrency value={holding.marketValue} className="font-mono font-semibold" label="market value" /></div>
                <div><span className="text-slate-500">Cost</span><SensitiveCurrency value={holding.costBasis} className="font-mono font-semibold" label="cost basis" /></div>
              </div>
              <Button className="mt-3 w-full" variant="secondary" onClick={() => openHoldingAlert(holding)} icon={<BellPlus className="h-4 w-4" />}>
                Add Alert ({alertRules.filter((rule) => rule.assetId === holding.id).length})
              </Button>
            </div>
          ))}
        </div>
        {!scopedHoldings.length ? <div className="p-5"><EmptyState title="No holdings yet" description="Connect and sync a brokerage account to populate holdings." /></div> : null}
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-950">Transactions</h2>
          <p className="mt-1 text-sm text-slate-500">Recent provider transactions when available.</p>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="financial-table min-w-[900px] w-full table-fixed text-left text-sm">
            <thead className="bg-slate-50/95 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="w-28 px-3 py-3">Date</th>
                <th className="w-24 px-3 py-3">Symbol</th>
                <th className="w-28 px-3 py-3">Type</th>
                <th className="w-32 px-3 py-3">Quantity</th>
                <th className="w-32 px-3 py-3">Price</th>
                <th className="w-32 px-3 py-3">Amount</th>
                <th className="w-24 px-3 py-3">Fees</th>
                <th className="w-44 px-3 py-3">Account</th>
              </tr>
            </thead>
            <tbody>
              {scopedTransactions.map((transaction) => (
                <tr key={transaction.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 text-slate-600">{formatDisplayDate(transaction.date)}</td>
                  <td className="px-3 py-3 font-semibold text-slate-950">{transaction.symbol || "N/A"}</td>
                  <td className="px-3 py-3"><Badge tone="neutral">{transaction.transactionType}</Badge></td>
                  <td className="px-3 py-3 font-mono text-slate-700"><SensitiveNumber value={transaction.quantity} digits={4} kind="shares" label="transaction quantity" /></td>
                  <td className="px-3 py-3"><SensitiveCurrency value={transaction.price} label="transaction price" /></td>
                  <td className="px-3 py-3 font-semibold text-slate-900"><SensitiveCurrency value={transaction.amount} label="transaction amount" /></td>
                  <td className="px-3 py-3"><SensitiveCurrency value={transaction.fees} label="transaction fees" /></td>
                  <td className="px-3 py-3 text-slate-600">{transaction.accountName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!scopedTransactions.length ? <div className="p-5"><EmptyState title="No transactions yet" description="Provider transactions will appear after a successful brokerage sync." /></div> : null}
      </Card>

      <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        Brokerage usernames and passwords are handled by SnapTrade, never by this app. Your Personal API key is encrypted at rest and never returned to the browser.
      </div>

      <Modal open={connectOpen} title="Connect SnapTrade Personal" onClose={() => !pending && setConnectOpen(false)} size="md">
        <form className="space-y-5" onSubmit={submitSnapTrade}>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-950">SnapTrade Personal</div>
            <div className="mt-1 text-sm leading-6 text-slate-600">Free personal brokerage connectivity. The connection is requested in read-only mode.</div>
            <Button className="mt-4 w-full sm:w-auto" variant="secondary" onClick={() => window.open("https://dashboard.snaptrade.com", "_blank", "noopener,noreferrer")} icon={<ExternalLink className="h-4 w-4" />}>
              Open SnapTrade dashboard
            </Button>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">Personal Client ID</span>
            <input className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" required />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">Personal Consumer Key</span>
            <input className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" type="password" value={consumerKey} onChange={(event) => setConsumerKey(event.target.value)} autoComplete="new-password" required />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setConnectOpen(false)} disabled={pending}>Cancel</Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={pending || !clientId.trim() || !consumerKey.trim()} icon={<Link2 className="h-4 w-4" />}>
              {pending ? "Opening SnapTrade..." : "Continue to SnapTrade"}
            </Button>
          </div>
        </form>
      </Modal>

      <AlertRuleForm
        open={Boolean(alertTarget)}
        target={alertTarget}
        onClose={() => setAlertTarget(null)}
        onSaved={(saved) => setAlertRules((current) => [saved, ...current.filter((rule) => rule.id !== saved.id)])}
      />
    </div>
  );
}
