"use client";

import { useSyncExternalStore } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CATEGORY_COLORS } from "@/lib/constants";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { usePrivacy } from "@/components/privacy/privacy-provider";
import { SensitivePercent } from "@/components/privacy/sensitive-value";
import { maskForKind } from "@/lib/privacy";

type AllocationPoint = {
  name: string;
  value: number;
  percentOfTotal: number;
};

const subscribe = () => () => undefined;

function useBrowserLayoutReady() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function AllocationPie({ data }: { data: AllocationPoint[] }) {
  const { valuesHidden } = usePrivacy();
  const layoutReady = useBrowserLayoutReady();
  if (!data.length) {
    return <div className="flex h-72 items-center justify-center text-sm text-slate-500">No allocation data</div>;
  }
  if (!layoutReady) return <div className="h-72 w-full" aria-hidden="true" />;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={92} innerRadius={56} paddingAngle={3}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || "#475569"} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "var(--chart-tooltip)", borderColor: "var(--chart-tooltip-border)", borderRadius: 8 }}
            itemStyle={{ color: "var(--foreground)" }}
            labelStyle={{ color: "var(--foreground)" }}
            formatter={(value, _name, item) => [
              valuesHidden ? `${maskForKind("currency")} (${maskForKind("percent")})` : `${formatCurrency(Number(value || 0))} (${formatPercent((item.payload as AllocationPoint).percentOfTotal)})`,
              "Value",
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AllocationLegend({ data }: { data: AllocationPoint[] }) {
  return (
    <div className="grid gap-2">
      {data.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[item.name] || "#475569" }}
            />
            <span className="truncate text-slate-700">{item.name}</span>
          </div>
          <SensitivePercent value={item.percentOfTotal} className="font-medium text-slate-950" label={`${item.name} allocation`} />
        </div>
      ))}
    </div>
  );
}
