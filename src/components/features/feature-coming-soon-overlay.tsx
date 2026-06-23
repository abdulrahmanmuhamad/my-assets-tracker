import { Clock3, LockKeyhole } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function FeatureComingSoonOverlay({
  title = "Coming Soon",
  description,
  badgeText = "Provider approval pending",
  featureName,
  children,
}: {
  title?: string;
  description: string;
  badgeText?: string;
  featureName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-[70vh] overflow-hidden rounded-lg" aria-label={`${featureName} coming soon`}>
      <div className="pointer-events-none select-none opacity-45 blur-[3px]" aria-hidden="true">
        {children}
      </div>
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-white/55 via-slate-100/65 to-sky-100/55 p-4 backdrop-blur-sm dark:from-slate-950/70 dark:via-slate-900/75 dark:to-sky-950/60 sm:p-8">
        <div className="w-full max-w-lg rounded-lg border border-white/80 bg-white/90 p-6 text-center shadow-2xl shadow-slate-950/15 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95 sm:p-9">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <Badge tone="warning" className="mt-5"><Clock3 className="mr-1.5 h-3.5 w-3.5" />{badgeText}</Badge>
          <h1 className="mt-5 text-3xl font-semibold text-slate-950 dark:text-white">{title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
          <div className="mt-6 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{featureName}</div>
        </div>
      </div>
    </div>
  );
}
