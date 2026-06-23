"use client";

import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrivacy } from "./privacy-provider";

export function PrivacyToggleButton({ className }: { className?: string }) {
  const { valuesHidden, toggleValuesHidden } = usePrivacy();
  return (
    <button
      type="button"
      className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100", className)}
      onClick={toggleValuesHidden}
      aria-label={valuesHidden ? "Reveal all financial values" : "Hide all financial values"}
      title={valuesHidden ? "Reveal all financial values" : "Hide all financial values"}
    >
      {valuesHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </button>
  );
}
