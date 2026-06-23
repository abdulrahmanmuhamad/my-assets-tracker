import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Boxes } from "lucide-react";
import { Badge } from "./badge";
import { Button } from "./button";
import { cn, formatPercent } from "@/lib/utils";
import { SensitiveValue } from "@/components/privacy/sensitive-value";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-slate-200/80 bg-white/70 p-5 shadow-[0_22px_70px_-48px_rgba(15,23,42,0.55)] backdrop-blur md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">{eyebrow}</div> : null}
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 md:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header-actions flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function RoiBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <Badge tone={positive ? "positive" : "negative"} className="font-mono tabular-nums">
      {positive ? <ArrowUpRight className="mr-1 h-3 w-3" /> : <ArrowDownRight className="mr-1 h-3 w-3" />}
      <SensitiveValue kind="percent" label="ROI percentage">{formatPercent(value)}</SensitiveValue>
    </Badge>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
        <Boxes className="h-6 w-6" />
      </div>
      <div className="mt-4 text-base font-semibold text-slate-950">{title}</div>
      <div className="mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</div>
      {actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function ProgressBar({ value, tone = "info" }: { value: number; tone?: "info" | "positive" | "warning" }) {
  const colors = {
    info: "bg-sky-500",
    positive: "bg-emerald-500",
    warning: "bg-amber-500",
  };
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div className={cn("h-full rounded-full", colors[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
