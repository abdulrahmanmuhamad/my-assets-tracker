import { Activity, ArrowDownRight, ArrowUpRight, Bell, BellRing, CalendarClock, Gem, Home, Landmark, Sparkles, TrendingUp, WalletCards } from "lucide-react";
import { AllocationLegend, AllocationPie } from "@/components/charts/allocation-pie";
import { CashFlowChart, RoiBarChart } from "@/components/charts/report-charts";
import { PriceRefreshButton } from "@/components/price-refresh-button";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, MetricCard } from "@/components/ui/card";
import { PageHeader, ProgressBar, RoiBadge } from "@/components/ui/patterns";
import { SensitiveCurrency, SensitivePercent } from "@/components/privacy/sensitive-value";
import { getDashboardSummary, getPortfolioCollections } from "@/lib/data";
import { autoRefreshPricesIfStale } from "@/lib/prices";
import { requireApprovedPageUser } from "@/lib/page-auth";
import { isBanksFeatureEnabled, isStocksFeatureEnabled } from "@/lib/features";
import {
  formatCurrency,
  formatDisplayDate,
} from "@/lib/utils";

export const dynamic = "force-dynamic";

function categoryValue(summary: Awaited<ReturnType<typeof getDashboardSummary>>, name: string) {
  return summary.allocationByCategory.find((item) => item.name === name)?.value || 0;
}

export default async function DashboardPage() {
  await requireApprovedPageUser();
  await autoRefreshPricesIfStale();
  const [summary, collections] = await Promise.all([getDashboardSummary(), getPortfolioCollections()]);
  const bestAsset = summary.assets.slice().sort((a, b) => Number(b.roiPercent) - Number(a.roiPercent))[0];
  const worstAsset = summary.assets.slice().sort((a, b) => Number(a.roiPercent) - Number(b.roiPercent))[0];
  const recentAssets = summary.assets
    .slice()
    .sort((a, b) => String(b.purchaseDate).localeCompare(String(a.purchaseDate)))
    .slice(0, 6);
  const roiByCategory = summary.allocationByCategory.map((item) => ({ name: item.name, roiPercent: item.roiPercent }));
  const profitPositive = summary.totalProfitLoss >= 0;
  const stockCostBasisWarning = summary.stocks.summary.costBasisMissingCount > 0;
  const stocksEnabled = isStocksFeatureEnabled();
  const banksEnabled = isBanksFeatureEnabled();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portfolio command center"
        title="Dashboard"
        subtitle="A clean view of total wealth, cost basis, allocation, cash flow, and market-driven asset performance."
        actions={<PriceRefreshButton />}
      />

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden bg-slate-950 text-white">
          <div className="relative p-6 md:p-8">
            <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl" />
            <div className="absolute bottom-0 right-24 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={profitPositive ? "positive" : "negative"}>
                  {profitPositive ? <ArrowUpRight className="mr-1 h-3 w-3" /> : <ArrowDownRight className="mr-1 h-3 w-3" />}
                  <SensitivePercent value={summary.totalRoiPercent} label="total portfolio ROI" /> all time
                </Badge>
                <Badge className="border-white/10 bg-white/10 text-white">Private portfolio</Badge>
                {stocksEnabled && stockCostBasisWarning ? <Badge tone="warning">Some brokerage cost basis is missing</Badge> : null}
              </div>
              <div className="mt-8 text-sm font-medium text-slate-300">Total Portfolio Value</div>
              <div className="mt-2 font-mono text-5xl font-semibold tracking-normal tabular-nums md:text-6xl">
                <SensitiveCurrency value={summary.totalPortfolioValue} label="total portfolio value" />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-300">Cost Basis</div>
                  <div className="mt-2 font-mono text-xl font-semibold"><SensitiveCurrency value={summary.totalCostBasis} label="portfolio cost basis" /></div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-300">Profit / Loss</div>
                  <div className={profitPositive ? "mt-2 font-mono text-xl font-semibold text-emerald-300" : "mt-2 font-mono text-xl font-semibold text-rose-300"}>
                    <SensitiveCurrency value={summary.totalProfitLoss} label="portfolio profit or loss" />
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-300">Assets Tracked</div>
                  <div className="mt-2 font-mono text-xl font-semibold">
                    {summary.counts.minerals + summary.counts.realEstate + summary.counts.jewelry + summary.counts.stocks}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Performance Leaders</h2>
            <p className="mt-1 text-sm text-slate-500">Best and worst ROI at a glance</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {[bestAsset, worstAsset].filter(Boolean).map((asset, index) => (
              <div key={`${asset.id}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-950">{asset.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{asset.category} / {asset.subType}</div>
                  </div>
                  <RoiBadge value={Number(asset.roiPercent)} />
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div className="text-xs text-slate-500">Current value</div>
                  <SensitiveCurrency value={Number(asset.currentValue)} className="font-mono text-lg font-semibold text-slate-950" label="asset current value" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Minerals" value={formatCurrency(categoryValue(summary, "Minerals"))} detail={`${summary.counts.minerals} transactions`} tone="info" />
        <MetricCard label="Real Estate" value={formatCurrency(categoryValue(summary, "Real Estate"))} detail={`${summary.realEstate.rentedCount} rented properties`} tone="positive" />
        <MetricCard label="Jewelry" value={formatCurrency(categoryValue(summary, "Jewelry"))} detail={`${summary.counts.jewelry} items`} tone="warning" />
        {stocksEnabled ? <MetricCard label="Stocks" value={formatCurrency(categoryValue(summary, "Stocks"))} detail={`${summary.stocks.connections.length} brokers / ${summary.stocks.accounts.length} accounts`} tone="info" /> : <MetricCard label="Stocks" value="Coming Soon" detail="Provider approval pending" tone="warning" sensitive={false} />}
        {banksEnabled ? <MetricCard label="Banks / Cash" value={formatCurrency(summary.liquidCash)} detail={summary.includeLiquidCashInPortfolio ? "Included in portfolio" : "Not included in portfolio"} tone="positive" /> : <MetricCard label="Banks / Cash" value="Coming Soon" detail="Provider approval pending" tone="warning" sensitive={false} />}
      </div>

      {banksEnabled ? <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Liquid cash" value={formatCurrency(summary.liquidCash)} detail={`${summary.counts.bankAccounts} bank accounts`} tone="positive" />
        <MetricCard label="Credit-card debt" value={formatCurrency(summary.creditCardDebt)} detail="Informational, never added to portfolio value" tone="warning" />
        <MetricCard label="Net cash after debt" value={formatCurrency(summary.netCashAfterDebt)} detail="Liquid cash minus credit-card debt" tone={summary.netCashAfterDebt >= 0 ? "info" : "negative"} />
      </div> : null}
      {banksEnabled && summary.includeLiquidCashInPortfolio ? (
        <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <WalletCards className="mt-0.5 h-4 w-4 shrink-0" />
          Cash is included at face value and does not affect ROI gain/loss.
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active alerts" value={summary.alerts.activeAlerts} detail="Currently evaluated" tone="positive" sensitive={false} />
        <MetricCard label="Triggered alerts" value={summary.alerts.triggeredAlerts} detail="One-time conditions reached" tone="warning" sensitive={false} />
        <MetricCard label="Unread notifications" value={summary.alerts.unreadNotifications} detail="Open notification center" tone="info" sensitive={false} />
        <MetricCard label="Upcoming property reminders" value={summary.alerts.upcomingPayments.length + summary.alerts.upcomingRent.length} detail="Next 30 days" sensitive={false} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div><h2 className="text-base font-semibold text-slate-950">Upcoming Property Reminders</h2><p className="mt-1 text-sm text-slate-500">Payments and rent collection due within 30 days</p></div>
            <LinkButton href="/alerts" size="sm" icon={<CalendarClock className="h-4 w-4" />}>Manage</LinkButton>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...summary.alerts.upcomingPayments, ...summary.alerts.upcomingRent].slice(0, 6).map((rule) => (
              <div key={rule.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-3">
                <div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-950">{rule.name}</div><div className="mt-1 text-xs text-slate-500">{rule.alertType === "rent_due" ? "Rent collection" : "Property payment"}</div></div>
                <Badge tone="warning">{rule.dueDate ? formatDisplayDate(rule.dueDate) : "No date"}</Badge>
              </div>
            ))}
            {!summary.alerts.upcomingPayments.length && !summary.alerts.upcomingRent.length ? <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No property reminders in the next 30 days.</div> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div><h2 className="text-base font-semibold text-slate-950">Recent Triggered Alerts</h2><p className="mt-1 text-sm text-slate-500">Latest in-app and email events</p></div>
            <LinkButton href="/notifications" size="sm" icon={<Bell className="h-4 w-4" />}>Open</LinkButton>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.alerts.recentEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-3 rounded-md border border-slate-200 px-3 py-3">
                <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                <div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-950">{event.eventTitle}</div><div className="mt-1 line-clamp-2 text-xs text-slate-500">{event.eventMessage}</div></div>
              </div>
            ))}
            {!summary.alerts.recentEvents.length ? <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No alerts have triggered yet.</div> : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Asset Allocation</h2>
                <p className="mt-1 text-sm text-slate-500">Current portfolio value share</p>
              </div>
              <Badge tone="info"><SensitiveCurrency value={summary.totalPortfolioValue} label="portfolio allocation total" /></Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-[1fr_250px] md:items-center">
              <AllocationPie data={summary.allocationByCategory} />
              <AllocationLegend data={summary.allocationByCategory} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Allocation Progress</h2>
            <p className="mt-1 text-sm text-slate-500">Share of total portfolio by category</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.allocationByCategory.map((item) => (
              <div key={item.name}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-slate-800">{item.name}</span>
                  <SensitivePercent value={item.percentOfTotal} className="font-mono text-slate-600" label={`${item.name} allocation percentage`} />
                </div>
                <ProgressBar value={item.percentOfTotal} tone={item.roiPercent >= 0 ? "positive" : "warning"} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Category Performance</h2>
          </CardHeader>
          <CardContent>
            <RoiBarChart data={roiByCategory} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Real Estate Cash Flow</h2>
          </CardHeader>
          <CardContent>
            <CashFlowChart data={collections.realEstate.map((item) => ({ name: item.propertyName, monthlyNetCashFlow: item.monthlyNetCashFlow }))} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Recent Activity</h2>
            <p className="mt-1 text-sm text-slate-500">Recently purchased or added assets</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAssets.map((asset) => (
              <div key={asset.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                    {asset.category === "Minerals" ? (
                      <Sparkles className="h-4 w-4" />
                    ) : asset.category === "Real Estate" ? (
                      <Home className="h-4 w-4" />
                    ) : asset.category === "Stocks" ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <Gem className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-950">{asset.name}</div>
                    <div className="text-xs text-slate-500">{formatDisplayDate(asset.purchaseDate)} / {asset.subType}</div>
                  </div>
                </div>
                <div className="text-right">
                  <SensitiveCurrency value={Number(asset.currentValue)} className="font-mono text-sm font-semibold text-slate-950" label="asset current value" />
                  <div className="mt-1"><RoiBadge value={Number(asset.roiPercent)} /></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Cached Metal Prices</h2>
            <p className="mt-1 text-sm text-slate-500">Daily market feed with per-gram valuation</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {collections.prices.map((price) => (
                <div key={price.symbol} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                      <Landmark className="h-4 w-4 text-sky-600" />
                      {price.name}
                    </div>
                    <Badge tone="neutral">{price.currency}</Badge>
                  </div>
                  <div className="mt-4 font-mono text-2xl font-semibold tabular-nums text-slate-950">
                    <SensitiveCurrency value={price.pricePerTroyOunce} label={`${price.name} price per troy ounce`} />
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    <SensitiveCurrency value={price.pricePerGram} label={`${price.name} price per gram`} /> / gram
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <Activity className="h-3.5 w-3.5" />
                    {price.name === "Copper" ? "Converted from USD/lb" : price.source}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
