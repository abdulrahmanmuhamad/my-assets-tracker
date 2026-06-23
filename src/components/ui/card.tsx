import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SensitiveValue, type SensitiveKind } from "@/components/privacy/sensitive-value";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.45)] backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-slate-100 px-5 py-4", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
  sensitive = true,
  sensitiveKind = "currency",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "info" | "warning";
  sensitive?: boolean;
  sensitiveKind?: SensitiveKind;
}) {
  const detailKind = typeof detail === "string" && detail.includes("$")
    ? "currency"
    : typeof detail === "string" && detail.includes("%")
      ? "percent"
      : null;
  const tones = {
    neutral: "border-slate-200/80 bg-white",
    positive: "border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white",
    negative: "border-rose-200/80 bg-gradient-to-br from-rose-50 to-white",
    info: "border-sky-200/80 bg-gradient-to-br from-sky-50 to-white",
    warning: "border-amber-200/80 bg-gradient-to-br from-amber-50 to-white",
  };

  return (
    <Card className={cn("min-h-[126px] overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-[0_24px_70px_-42px_rgba(15,23,42,0.55)]", tones[tone])}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-3 font-mono text-2xl font-semibold tabular-nums text-slate-950 md:text-3xl">
        {sensitive ? <SensitiveValue kind={sensitiveKind} label={label}>{value}</SensitiveValue> : value}
      </div>
      {detail ? (
        <div className="mt-2 text-sm leading-5 text-slate-600">
          {detailKind ? <SensitiveValue kind={detailKind} label={`${label} detail`}>{detail}</SensitiveValue> : detail}
        </div>
      ) : null}
    </Card>
  );
}
