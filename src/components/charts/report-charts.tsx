"use client";

import { useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { usePrivacy } from "@/components/privacy/privacy-provider";
import { maskForKind } from "@/lib/privacy";

type Point = Record<string, string | number>;

const subscribe = () => () => undefined;
const tooltipStyle = { background: "var(--chart-tooltip)", borderColor: "var(--chart-tooltip-border)", borderRadius: 8 };
const tickStyle = { fontSize: 12, fill: "var(--chart-muted)" };

function useBrowserLayoutReady() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function ValueHistoryChart({ data }: { data: Point[] }) {
  const { valuesHidden } = usePrivacy();
  const layoutReady = useBrowserLayoutReady();
  if (!layoutReady) return <div className="h-72 w-full" aria-hidden="true" />;
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="date" tick={tickStyle} />
          <YAxis tick={tickStyle} tickFormatter={(value) => valuesHidden ? "••••" : `$${Math.round(Number(value) / 1000)}k`} />
          <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "var(--foreground)" }} formatter={(value) => valuesHidden ? maskForKind("currency") : formatCurrency(Number(value || 0))} />
          <Line type="monotone" dataKey="costBasis" stroke="#64748b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="currentValue" stroke="#2563eb" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RoiBarChart({ data }: { data: Point[] }) {
  const { valuesHidden } = usePrivacy();
  const layoutReady = useBrowserLayoutReady();
  if (!layoutReady) return <div className="h-72 w-full" aria-hidden="true" />;
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
        <BarChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="name" tick={tickStyle} />
          <YAxis tick={tickStyle} tickFormatter={(value) => valuesHidden ? "••••" : `${value}%`} />
          <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "var(--foreground)" }} formatter={(value) => valuesHidden ? maskForKind("percent") : formatPercent(Number(value || 0))} />
          <Bar dataKey="roiPercent" fill="#14b8a6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CashFlowChart({ data }: { data: Point[] }) {
  const { valuesHidden } = usePrivacy();
  const layoutReady = useBrowserLayoutReady();
  if (!layoutReady) return <div className="h-72 w-full" aria-hidden="true" />;
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
        <BarChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis dataKey="name" tick={tickStyle} />
          <YAxis tick={tickStyle} tickFormatter={(value) => valuesHidden ? "••••" : `$${Number(value) / 1000}k`} />
          <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "var(--foreground)" }} formatter={(value) => valuesHidden ? maskForKind("currency") : formatCurrency(Number(value || 0))} />
          <Bar dataKey="monthlyNetCashFlow" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
