import Link from "next/link";
import { BarChart3, LockKeyhole, ShieldCheck } from "lucide-react";

export function AuthFrame({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative flex min-h-[300px] flex-col justify-between overflow-hidden border-b border-white/10 p-6 sm:p-10 lg:min-h-screen lg:border-b-0 lg:border-r lg:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(14,165,233,0.18),transparent_28%),radial-gradient(circle_at_80%_80%,rgba(16,185,129,0.14),transparent_30%)]" />
          <Link href="/" className="relative flex items-center gap-3 text-sm font-semibold">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10">
              <BarChart3 className="h-5 w-5" />
            </span>
            Asset Portfolio
          </Link>
          <div className="relative max-w-xl py-12 lg:py-0">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">{eyebrow}</div>
            <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">{title}</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">{description}</p>
          </div>
          <div className="relative flex flex-wrap gap-5 text-xs font-medium text-slate-400">
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" />Verified identity</span>
            <span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-sky-400" />Owner-approved access</span>
          </div>
        </section>
        <section className="flex items-center justify-center bg-slate-50 px-4 py-10 text-slate-950 sm:px-8">
          <div className="w-full max-w-md">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-950/10 sm:p-8">{children}</div>
            {footer ? <div className="mt-5 text-center text-sm text-slate-500">{footer}</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
