"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  title,
  children,
  onClose,
  size = "lg",
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: "md" | "lg" | "xl";
}) {
  if (!open) {
    return null;
  }

  const sizes = {
    md: "max-w-lg",
    lg: "max-w-3xl",
    xl: "max-w-6xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className={cn("max-h-[92vh] w-full overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl", sizes[size])}>
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <Button aria-label="Close" title="Close" variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-[calc(92vh-64px)] overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}
