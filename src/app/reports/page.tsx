import { Download } from "lucide-react";
import { CashFlowChart, RoiBarChart, ValueHistoryChart } from "@/components/charts/report-charts";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, MetricCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/patterns";
import { flattenPortfolioAssets, getDashboardSummary, getPortfolioCollections } from "@/lib/data";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { SensitiveCurrency, SensitivePercent } from "@/components/privacy/sensitive-value";
import { requireApprovedPageUser } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireApprovedPageUser();
  const [collections, summary] = await Promise.all([getPortfolioCollections(), getDashboardSummary()]);
  const assets = flattenPortfolioAssets(collections);
  const sortedByDate = assets.slice().sort((a, b) => String(a.purchaseDate).localeCompare(String(b.purchaseDate)));
  const history = sortedByDate.reduce<{ rows: { date: string; costBasis: number; currentValue: number }[]; cost: number; value: number }>(
    (state, asset) => {
      const cost = state.cost + Number(asset.purchasePrice);
      const value = state.value + Number(asset.currentValue);
      return {
        cost,
        value,
        rows: [
          ...state.rows,
          {
            date: String(asset.purchaseDate),
            costBasis: cost,
            currentValue: value,
          },
        ],
      };
    },
    { rows: [], cost: 0, value: 0 },
  ).rows;
  const roiByCategory = summary.allocationByCategory.map((item) => ({ name: item.name, roiPercent: item.roiPercent }));
  const best = assets.slice().sort((a, b) => Number(b.roiPercent) - Number(a.roiPercent)).slice(0, 5);
  const worst = assets.slice().sort((a, b) => Number(a.roiPercent) - Number(b.roiPercent)).slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Reports"
        subtitle="Portfolio trend, ROI rankings, category breakdowns, cash flow, and exports."
        actions={
          <>
          <LinkButton href="/api/reports/export/csv" icon={<Download className="h-4 w-4" />}>
            Export CSV
          </LinkButton>
          <LinkButton href="/api/reports/export/pdf" icon={<Download className="h-4 w-4" />}>
            Export PDF
          </LinkButton>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Portfolio value" value={formatCurrency(summary.totalPortfolioValue)} tone="info" />
        <MetricCard label="Cost basis" value={formatCurrency(summary.totalCostBasis)} />
        <MetricCard label="Profit / loss" value={formatCurrency(summary.totalProfitLoss)} tone={summary.totalProfitLoss >= 0 ? "positive" : "negative"} />
        <MetricCard label="ROI" value={formatPercent(summary.totalRoiPercent)} tone={summary.totalRoiPercent >= 0 ? "positive" : "negative"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Value Over Time</h2>
          </CardHeader>
          <CardContent>
            <ValueHistoryChart data={history} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">ROI by Category</h2>
          </CardHeader>
          <CardContent>
            <RoiBarChart data={roiByCategory} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Real Estate Monthly Cash Flow</h2>
          </CardHeader>
          <CardContent>
            <CashFlowChart data={collections.realEstate.map((item) => ({ name: item.propertyName, monthlyNetCashFlow: item.monthlyNetCashFlow }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Asset Rankings</h2>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-800">Best</div>
                <div className="space-y-2">
                  {best.map((asset) => (
                    <div key={asset.id} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 p-2">
                      <span className="truncate text-sm text-slate-700">{asset.name}</span>
                      <Badge tone="positive"><SensitivePercent value={Number(asset.roiPercent)} label="asset ROI" /></Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-800">Worst</div>
                <div className="space-y-2">
                  {worst.map((asset) => (
                    <div key={asset.id} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 p-2">
                      <span className="truncate text-sm text-slate-700">{asset.name}</span>
                      <Badge tone={Number(asset.roiPercent) >= 0 ? "positive" : "negative"}><SensitivePercent value={Number(asset.roiPercent)} label="asset ROI" /></Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-950">Breakdowns</h2>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
              <tr>
                <th className="px-4 py-3">Sub-Type</th>
                <th className="px-4 py-3">Current Value</th>
                <th className="px-4 py-3">Cost Basis</th>
                <th className="px-4 py-3">ROI</th>
                <th className="px-4 py-3">Allocation</th>
              </tr>
            </thead>
            <tbody>
              {summary.allocationBySubtype.map((item) => (
                <tr key={item.name} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-950">{item.name}</td>
                  <td className="px-4 py-3"><SensitiveCurrency value={item.value} label="category value" /></td>
                  <td className="px-4 py-3"><SensitiveCurrency value={item.cost} label="category cost" /></td>
                  <td className="px-4 py-3">
                    <Badge tone={item.roiPercent >= 0 ? "positive" : "negative"}><SensitivePercent value={item.roiPercent} label="category ROI" /></Badge>
                  </td>
                  <td className="px-4 py-3"><SensitivePercent value={item.percentOfTotal} label="allocation percentage" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
