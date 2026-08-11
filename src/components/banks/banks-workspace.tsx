"use client";

import Image from "next/image";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { AlertTriangle, BellPlus, CreditCard, ExternalLink, Landmark, Link2, RefreshCcw, ShieldCheck, Trash2, WalletCards } from "lucide-react";
import { AlertRuleForm } from "@/components/alerts/alert-rule-form";
import { PrivacyToggleButton } from "@/components/privacy/privacy-toggle-button";
import { SensitiveCurrency } from "@/components/privacy/sensitive-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, MetricCard } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { EmptyState, PageHeader } from "@/components/ui/patterns";
import type { AlertRuleRecord, AlertTarget } from "@/lib/alerts/client-types";
import { cn, formatDisplayDate, titleFromSnake } from "@/lib/utils";

type BankConnection = {
  id: string;
  provider: string;
  institutionId?: string | null;
  institutionName: string;
  institutionLogoUrl?: string | null;
  status: string;
  productsEnabled: string[];
  syncWarning?: string | null;
  lastSyncedAt?: string | null;
};

type BankAccount = {
  id: string;
  bankConnectionId: string;
  providerAccountId: string;
  institutionName: string;
  accountName: string;
  officialName?: string | null;
  accountType: string;
  accountSubtype?: string | null;
  mask?: string | null;
  currency: string;
  currentBalance?: number | null;
  availableBalance?: number | null;
  creditLimit?: number | null;
  includeInLiquidCash: boolean;
  isDebtAccount: boolean;
  syncStatus: string;
  lastBalanceUpdatedAt?: string | null;
};

type BankTransaction = {
  id: string;
  bankAccountId: string;
  bankConnectionId: string;
  date: string;
  authorizedDate?: string | null;
  name: string;
  merchantName?: string | null;
  category?: string | null;
  personalFinanceCategory?: string | null;
  amount: number;
  currency: string;
  pending: boolean;
  paymentChannel?: string | null;
  transactionType?: string | null;
  notes?: string | null;
  accountName: string;
};

type BanksPortfolio = {
  connections: BankConnection[];
  accounts: BankAccount[];
  transactions: BankTransaction[];
  summary: {
    liquidCash: number;
    creditCardDebt: number;
    netCashAfterDebt: number;
    accountCount: number;
    connectedBanks: number;
    lastSyncedAt?: string | null;
  };
};

function statusTone(status: string) {
  return status === "active" ? "positive" : status === "disconnected" ? "neutral" : "warning";
}

function accountSummary(accounts: BankAccount[]) {
  const liquidCash = accounts.reduce(
    (total, account) => total + (account.accountType === "depository" && account.includeInLiquidCash ? account.currentBalance || 0 : 0),
    0,
  );
  const creditCardDebt = accounts.reduce(
    (total, account) => total + (account.isDebtAccount ? Math.max(0, account.currentBalance || 0) : 0),
    0,
  );
  return { liquidCash, creditCardDebt, netCashAfterDebt: liquidCash - creditCardDebt };
}

export function BanksWorkspace({ initialPortfolio }: { initialPortfolio: BanksPortfolio }) {
  const [portfolio, setPortfolio] = useState(initialPortfolio);
  const [activeConnectionId, setActiveConnectionId] = useState(initialPortfolio.connections[0]?.id || "");
  const [connectOpen, setConnectOpen] = useState(false);
  const [setupToken, setSetupToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [alertTarget, setAlertTarget] = useState<AlertTarget | null>(null);
  const [alertRules, setAlertRules] = useState<AlertRuleRecord[]>([]);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/banks", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not refresh bank data");
    setPortfolio(data);
    setActiveConnectionId((current) => data.connections.some((connection: BankConnection) => connection.id === current) ? current : data.connections[0]?.id || "");
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/alerts?assetCategory=bank", { cache: "no-store" }).then((response) => response.ok ? response.json() : []),
      fetch("/api/alerts?assetCategory=bank_account", { cache: "no-store" }).then((response) => response.ok ? response.json() : []),
    ]).then(([bankRules, accountRules]) => setAlertRules([...bankRules, ...accountRules])).catch(() => setAlertRules([]));
  }, []);

  function connectBank() {
    setError("");
    setConnectOpen(true);
  }

  async function submitSimpleFin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/banks/simplefin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupToken }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not connect SimpleFIN");
      setSetupToken("");
      setConnectOpen(false);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not connect SimpleFIN");
    } finally {
      setPending(false);
    }
  }

  async function sync(connectionId?: string) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(connectionId ? `/api/banks/sync/${connectionId}` : "/api/banks/sync", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not sync bank data");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sync bank data");
    } finally {
      setPending(false);
    }
  }

  async function disconnect(connectionId: string) {
    if (!window.confirm("Disconnect this bank and remove its imported accounts and transactions from this portfolio?")) return;
    setPending(true);
    try {
      const response = await fetch(`/api/banks/connections/${connectionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteData: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not disconnect bank");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not disconnect bank");
    } finally {
      setPending(false);
    }
  }

  async function toggleLiquidCash(account: BankAccount) {
    const response = await fetch(`/api/banks/accounts/${account.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeInLiquidCash: !account.includeInLiquidCash }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not update account");
      return;
    }
    await refresh();
  }

  const activeConnection = portfolio.connections.find((connection) => connection.id === activeConnectionId) || portfolio.connections[0];
  const accounts = activeConnection ? portfolio.accounts.filter((account) => account.bankConnectionId === activeConnection.id) : [];
  const transactions = activeConnection ? portfolio.transactions.filter((transaction) => transaction.bankConnectionId === activeConnection.id) : [];
  const scopedSummary = accountSummary(accounts);
  const latestTransactions = transactions.slice(0, 100);

  function openBankAlert() {
    setAlertTarget({ assetCategory: "bank", label: "All banks", baselineValue: portfolio.summary.liquidCash });
  }

  function openAccountAlert(account: BankAccount) {
    setAlertTarget({ assetCategory: "bank_account", assetId: account.id, label: account.accountName, baselineValue: account.currentBalance });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cash and liabilities"
        title="Banks"
        subtitle="Track liquid cash, bank balances, credit-card debt, and bank transactions."
        actions={
          <>
            <Badge tone="neutral">Last synced {portfolio.summary.lastSyncedAt ? formatDisplayDate(portfolio.summary.lastSyncedAt) : "never"}</Badge>
            <PrivacyToggleButton />
            <Button variant="secondary" onClick={openBankAlert} icon={<BellPlus className="h-4 w-4" />}>Alerts</Button>
            <Button variant="secondary" onClick={() => sync()} disabled={pending || !portfolio.summary.connectedBanks} icon={<RefreshCcw className={cn("h-4 w-4", pending && "animate-spin")} />}>Sync All</Button>
            <Button onClick={connectBank} disabled={pending} icon={<Link2 className="h-4 w-4" />}>Connect Bank</Button>
          </>
        }
      />

      {error ? <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Total liquid cash" value={`$${portfolio.summary.liquidCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} tone="positive" />
        <MetricCard label="Credit-card debt" value={`$${portfolio.summary.creditCardDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} tone="warning" />
        <MetricCard label="Net cash after debt" value={`$${portfolio.summary.netCashAfterDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} tone={portfolio.summary.netCashAfterDebt >= 0 ? "info" : "negative"} />
        <MetricCard label="Connected banks" value={portfolio.summary.connectedBanks} sensitive={false} detail="Active connections" />
        <MetricCard label="Bank accounts" value={portfolio.summary.accountCount} sensitive={false} detail="Depository and credit" />
        <MetricCard label="Last synced" value={portfolio.summary.lastSyncedAt ? formatDisplayDate(portfolio.summary.lastSyncedAt) : "Never"} sensitive={false} />
      </div>

      {!portfolio.connections.length ? (
        <Card><CardContent className="p-8"><EmptyState title="Connect your first bank" description="Securely connect checking, savings, and credit-card accounts to track liquid cash, debt, and recent activity. Bank credentials are never stored by this app." actionLabel="Connect Bank" onAction={connectBank} /></CardContent></Card>
      ) : null}

      {portfolio.connections.length ? (
        <Card>
          <CardContent className="flex gap-2 overflow-x-auto p-3">
            {portfolio.connections.map((connection) => (
              <button key={connection.id} className={cn("flex h-11 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-semibold", activeConnection?.id === connection.id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200")} onClick={() => setActiveConnectionId(connection.id)}>
                {connection.institutionName}<Badge tone={statusTone(connection.status)}>{connection.status}</Badge>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {activeConnection ? (
        <>
          <Card>
            <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 text-slate-600">
                  {activeConnection.institutionLogoUrl ? <Image src={activeConnection.institutionLogoUrl} alt="" width={48} height={48} unoptimized /> : <Landmark className="h-5 w-5" />}
                </div>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-semibold text-slate-950">{activeConnection.institutionName}</h2><Badge tone={statusTone(activeConnection.status)}>{activeConnection.status}</Badge></div><div className="mt-1 text-sm text-slate-500">{accounts.length} accounts / {transactions.length} recent transactions</div></div>
              </div>
              <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => sync(activeConnection.id)} disabled={pending} icon={<RefreshCcw className="h-4 w-4" />}>Sync Bank</Button><Button variant="danger" onClick={() => disconnect(activeConnection.id)} disabled={pending || activeConnection.status === "disconnected"} icon={<Trash2 className="h-4 w-4" />}>Disconnect</Button></div>
            </CardContent>
          </Card>
          {activeConnection.syncWarning ? <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Partial sync:</strong> {activeConnection.syncWarning}. Available balances were still saved.</span></div> : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Bank liquid cash" value={`$${scopedSummary.liquidCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} tone="positive" />
            <MetricCard label="Bank card debt" value={`$${scopedSummary.creditCardDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} tone="warning" />
            <MetricCard label="Bank net cash" value={`$${scopedSummary.netCashAfterDebt.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} tone={scopedSummary.netCashAfterDebt >= 0 ? "info" : "negative"} />
            <MetricCard label="Recent transactions" value={latestTransactions.length} sensitive={false} />
          </div>
        </>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => {
          const availableCredit = account.creditLimit === null || account.creditLimit === undefined ? null : account.creditLimit - (account.currentBalance || 0);
          return (
            <Card key={account.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">{account.isDebtAccount ? <CreditCard className="h-4 w-4" /> : <WalletCards className="h-4 w-4" />}</div><div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-950">{account.accountName}</div><div className="truncate text-xs text-slate-500">{account.officialName || titleFromSnake(account.accountSubtype || account.accountType)}{account.mask ? ` / ${account.mask}` : ""}</div></div></div>
                  <Badge tone={account.isDebtAccount ? "warning" : "positive"}>{account.isDebtAccount ? "Debt account" : account.currency}</Badge>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div><div className="text-xs uppercase tracking-[0.12em] text-slate-500">Current balance</div><SensitiveCurrency value={account.currentBalance} className="mt-1 font-mono font-semibold text-slate-950" /></div>
                  <div><div className="text-xs uppercase tracking-[0.12em] text-slate-500">Available</div><SensitiveCurrency value={account.availableBalance} className="mt-1 font-mono font-semibold text-slate-950" /></div>
                  {account.isDebtAccount ? <><div><div className="text-xs uppercase tracking-[0.12em] text-slate-500">Credit limit</div><SensitiveCurrency value={account.creditLimit} className="mt-1 font-mono font-semibold" /></div><div><div className="text-xs uppercase tracking-[0.12em] text-slate-500">Available credit</div><SensitiveCurrency value={availableCredit} className="mt-1 font-mono font-semibold" /></div></> : null}
                </div>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                  {account.accountType === "depository" ? <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={account.includeInLiquidCash} onChange={() => toggleLiquidCash(account)} />Include in liquid cash</label> : <Badge tone="neutral">{account.syncStatus}</Badge>}
                  <Button size="icon" variant="ghost" onClick={() => openAccountAlert(account)} aria-label="Add account alert" title={`Add account alert (${alertRules.filter((rule) => rule.assetId === account.id).length})`}><BellPlus className="h-4 w-4" /></Button>
                </div>
                <div className="mt-3 text-xs text-slate-500">Updated {account.lastBalanceUpdatedAt ? formatDisplayDate(account.lastBalanceUpdatedAt) : "not yet"}</div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {activeConnection && !accounts.length ? <Card><CardContent><EmptyState title="No bank accounts returned" description="Sync this institution again. Investment-only accounts remain on the Stocks page." /></CardContent></Card> : null}

      <Card>
        <CardHeader><h2 className="text-base font-semibold text-slate-950">Recent Transactions</h2><p className="mt-1 text-sm text-slate-500">Deposits, withdrawals, card activity, pending items, and provider categories when available.</p></CardHeader>
        <div className="hidden overflow-x-auto md:block">
          <table className="financial-table w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Merchant / Name</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Channel</th><th className="px-4 py-3">Type</th></tr></thead>
            <tbody>{latestTransactions.map((transaction) => <tr key={transaction.id} className="border-t border-slate-100"><td className="px-4 py-3 text-slate-600">{formatDisplayDate(transaction.date)}</td><td className="px-4 py-3 text-slate-600">{transaction.accountName}</td><td className="px-4 py-3 font-medium text-slate-950">{transaction.merchantName || transaction.name}</td><td className="px-4 py-3 text-slate-600">{transaction.personalFinanceCategory || transaction.category || "Uncategorized"}</td><td className="px-4 py-3"><SensitiveCurrency value={transaction.amount} className="font-mono font-semibold" label="transaction amount" /></td><td className="px-4 py-3"><Badge tone={transaction.pending ? "warning" : "positive"}>{transaction.pending ? "Pending" : "Posted"}</Badge></td><td className="px-4 py-3 text-slate-600">{transaction.paymentChannel || "N/A"}</td><td className="px-4 py-3 text-slate-600">{transaction.transactionType || "N/A"}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="grid gap-3 p-4 md:hidden">{latestTransactions.map((transaction) => <article key={transaction.id} className="rounded-md border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-950">{transaction.merchantName || transaction.name}</div><div className="mt-1 text-xs text-slate-500">{transaction.accountName} / {formatDisplayDate(transaction.date)}</div></div><SensitiveCurrency value={transaction.amount} className="font-mono font-semibold" label="transaction amount" /></div><div className="mt-3 flex flex-wrap gap-2"><Badge tone={transaction.pending ? "warning" : "positive"}>{transaction.pending ? "Pending" : "Posted"}</Badge><Badge tone="neutral">{transaction.personalFinanceCategory || transaction.category || "Uncategorized"}</Badge></div></article>)}</div>
        {!latestTransactions.length ? <CardContent><EmptyState title="No transactions yet" description="Transactions will appear after SimpleFIN completes the first account refresh." /></CardContent> : null}
      </Card>

      <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Bank credentials are never received by this app. The read-only SimpleFIN access URL is encrypted at rest and never returned to the browser.</div>

      <Modal open={connectOpen} title="Connect banks with SimpleFIN" onClose={() => !pending && setConnectOpen(false)} size="md">
        <form className="space-y-5" onSubmit={submitSimpleFin}>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-950">SimpleFIN Bridge</div>
            <div className="mt-1 text-sm leading-6 text-slate-600">Read-only bank balances and transactions. SimpleFIN currently charges $15 per year or $1.50 per month.</div>
            <Button className="mt-4 w-full sm:w-auto" variant="secondary" onClick={() => window.open("https://bridge.simplefin.org/simplefin/create", "_blank", "noopener,noreferrer")} icon={<ExternalLink className="h-4 w-4" />}>
              Create setup token
            </Button>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">One-time setup token</span>
            <textarea
              className="mt-2 min-h-28 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs leading-5 text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              value={setupToken}
              onChange={(event) => setSetupToken(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="Paste the token from SimpleFIN Bridge"
              required
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setConnectOpen(false)} disabled={pending}>Cancel</Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={pending || !setupToken.trim()} icon={<Link2 className="h-4 w-4" />}>
              {pending ? "Connecting..." : "Connect banks"}
            </Button>
          </div>
        </form>
      </Modal>

      <AlertRuleForm open={Boolean(alertTarget)} target={alertTarget} onClose={() => setAlertTarget(null)} onSaved={(rule) => setAlertRules((current) => [rule, ...current.filter((item) => item.id !== rule.id)])} />
    </div>
  );
}
