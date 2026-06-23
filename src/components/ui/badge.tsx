import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  negative: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", tones[tone], className)}
      {...props}
    />
  );
}
