"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn, formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { usePrivacy } from "./privacy-provider";
import { maskForKind, resolveSensitiveHidden, type SensitiveKind } from "@/lib/privacy";

export type { SensitiveKind } from "@/lib/privacy";

export function SensitiveValue({
  children,
  kind = "number",
  className,
  label = "financial value",
}: {
  children: React.ReactNode;
  kind?: SensitiveKind;
  className?: string;
  label?: string;
}) {
  const { valuesHidden } = usePrivacy();
  const [override, setOverride] = useState<{ globalState: boolean; hidden: boolean } | null>(null);
  const localHidden = override?.globalState === valuesHidden ? override.hidden : null;
  const hidden = resolveSensitiveHidden(valuesHidden, localHidden);

  return (
    <span className={cn("inline-flex min-h-7 min-w-0 items-center gap-1.5", className)}>
      <span className="min-w-[6ch] tabular-nums" aria-label={hidden ? `${label} hidden` : label}>
        {hidden ? maskForKind(kind) : children}
      </span>
      <button
        type="button"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        onClick={() => setOverride({ globalState: valuesHidden, hidden: !hidden })}
        aria-label={`${hidden ? "Reveal" : "Hide"} ${label}`}
        title={`${hidden ? "Reveal" : "Hide"} ${label}`}
      >
        {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}

export function SensitiveCurrency({ value, className, label }: { value: number | null | undefined; className?: string; label?: string }) {
  const display = value === null || value === undefined ? "N/A" : formatCurrency(value);
  return <SensitiveValue kind="currency" className={className} label={label || "currency value"}>{display}</SensitiveValue>;
}

export function SensitivePercent({ value, className, label }: { value: number | null | undefined; className?: string; label?: string }) {
  const display = value === null || value === undefined ? "N/A" : formatPercent(value);
  return <SensitiveValue kind="percent" className={className} label={label || "percentage value"}>{display}</SensitiveValue>;
}

export function SensitiveNumber({ value, digits = 2, className, label, kind = "number" }: { value: number | null | undefined; digits?: number; className?: string; label?: string; kind?: SensitiveKind }) {
  const display = value === null || value === undefined ? "N/A" : formatNumber(value, digits);
  return <SensitiveValue kind={kind} className={className} label={label || "numeric value"}>{display}</SensitiveValue>;
}
