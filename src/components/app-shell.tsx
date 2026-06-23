"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton, UserButton, useUser } from "@clerk/nextjs";
import {
  BarChart3,
  Bell,
  Building2,
  ChartNoAxesCombined,
  Gem,
  Home,
  LineChart,
  ListChecks,
  Landmark,
  Menu,
  Search,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PrivacyToggleButton } from "@/components/privacy/privacy-toggle-button";
import { isBanksFeatureEnabled, isStocksFeatureEnabled } from "@/lib/features";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/minerals", label: "Minerals", icon: Sparkles },
  { href: "/jewelry", label: "Jewelry", icon: Gem },
  { href: "/real-estate", label: "Real Estate", icon: Building2 },
  { href: "/stocks", label: "Stocks", icon: TrendingUp, feature: "stocks" },
  { href: "/banks", label: "Banks", icon: Landmark, feature: "banks" },
  { href: "/market-indexes", label: "Market Indexes", icon: ChartNoAxesCombined },
  { href: "/alerts", label: "Alerts", icon: ListChecks },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/reports", label: "Reports", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentPage = navItems.find((item) => (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)));
  const isAuthPage = ["/sign-in", "/sign-up", "/verify-email", "/pending-approval", "/account-disabled"].some((route) => pathname.startsWith(route));
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profile, setProfile] = useState<{ username?: string | null; displayName?: string | null; email?: string | null } | null>(null);
  const stocksEnabled = isStocksFeatureEnabled();
  const banksEnabled = isBanksFeatureEnabled();

  function isComingSoon(feature?: string) {
    return feature === "stocks" ? !stocksEnabled : feature === "banks" ? !banksEnabled : false;
  }

  useEffect(() => {
    if (isAuthPage) return;
    fetch("/api/notifications?unread=true", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((events) => setUnreadCount(Array.isArray(events) ? events.length : 0))
      .catch(() => setUnreadCount(0));
  }, [isAuthPage, pathname]);

  useEffect(() => {
    if (isAuthPage) return;
    const loadProfile = () => fetch("/api/profile", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => data && setProfile(data))
      .catch(() => undefined);
    const handleUpdate = (event: Event) => setProfile((event as CustomEvent).detail);
    loadProfile();
    window.addEventListener("portfolio:profile-updated", handleUpdate);
    return () => window.removeEventListener("portfolio:profile-updated", handleUpdate);
  }, [isAuthPage, pathname]);

  if (isAuthPage) {
    return <main className="min-h-screen bg-slate-50">{children}</main>;
  }

  return (
    <div className="min-h-screen text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200/70 bg-white/80 shadow-[18px_0_60px_-50px_rgba(15,23,42,0.65)] backdrop-blur-xl lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-20 items-center gap-3 border-b border-slate-200/80 px-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-semibold text-slate-950">Asset Portfolio</div>
              <div className="text-xs font-medium text-slate-500">Private wealth ledger</div>
            </div>
          </div>
          <nav className="flex-1 space-y-1.5 px-3 py-5">
            {navItems.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition",
                    active
                      ? "bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                      : "text-slate-600 hover:bg-slate-100/90 hover:text-slate-950",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {isComingSoon(item.feature) ? <span className={active ? "ml-auto text-[10px] font-bold uppercase text-slate-300" : "ml-auto text-[10px] font-bold uppercase text-amber-600"}>Soon</span> : null}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-slate-200/80 p-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <BarChart3 className="h-4 w-4 text-sky-600" />
                Portfolio OS
              </div>
              <div className="mt-2 text-xs leading-5 text-slate-500">PostgreSQL, Prisma, private file routes.</div>
            </div>
          </div>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-slate-200/70 bg-white/75 px-4 backdrop-blur-xl lg:px-8">
          <Link href="/" className="flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white">
              <Shield className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold">Asset Portfolio</span>
          </Link>
          <div className="hidden items-center gap-4 lg:flex">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Workspace</div>
              <div className="text-sm font-semibold text-slate-900">{currentPage?.label || "Dashboard"}</div>
            </div>
            <div className="flex h-10 w-[340px] items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              Search assets, receipts, properties
            </div>
          </div>
          <div className="ml-auto hidden items-center gap-3 lg:flex">
            <PrivacyToggleButton />
            <Link
              href="/notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount ? (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-5 text-white">
                  {Math.min(unreadCount, 99)}
                </span>
              ) : null}
            </Link>
            {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
              <ClerkUserSummary profile={profile} />
            ) : (
              <>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">Portfolio Owner</div>
                  <div className="text-xs text-slate-500">Private session</div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">PO</div>
              </>
            )}
          </div>
          <nav className="ml-auto flex items-center gap-1 lg:hidden">
            <PrivacyToggleButton className="border-0 bg-transparent" />
            <Link
              href="/notifications"
              aria-label="Notifications"
              title="Notifications"
              className={cn(
                "relative flex h-10 min-w-10 items-center justify-center rounded-xl",
                pathname.startsWith("/notifications") ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <Bell className="h-4 w-4" />
              {unreadCount ? <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-rose-500" /> : null}
            </Link>
            <button
              type="button"
              className="flex h-10 min-w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              title="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-slate-950/45" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 right-0 w-[min(88vw,340px)] border-l border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="text-sm font-semibold text-slate-950">Navigation</div>
              <button className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100" onClick={() => setMobileOpen(false)} aria-label="Close navigation" title="Close navigation">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-4 grid gap-1.5">
              {navItems.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={cn("flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold", active ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-100")}>
                    <Icon className="h-4 w-4" />{item.label}{isComingSoon(item.feature) ? <span className="ml-auto text-[10px] font-bold uppercase text-amber-600">Soon</span> : null}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function ClerkUserSummary({ profile }: { profile: { username?: string | null; displayName?: string | null; email?: string | null } | null }) {
  const { user } = useUser();
  const email = profile?.email || user?.primaryEmailAddress?.emailAddress;
  const label = profile?.displayName || profile?.username || user?.fullName || email || "Portfolio user";

  return (
    <>
      <div className="text-right">
        <div className="text-sm font-semibold text-slate-900">
          {label}
        </div>
        <div className="max-w-48 truncate text-xs text-slate-500">{email || "Private session"}</div>
      </div>
      <>
        <UserButton />
        <SignOutButton>
          <button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
            Sign out
          </button>
        </SignOutButton>
      </>
    </>
  );
}
