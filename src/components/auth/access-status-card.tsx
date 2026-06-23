"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Clock3, LoaderCircle, LogOut, RefreshCcw, ShieldX } from "lucide-react";

type StatusUser = {
  username: string | null;
  displayName: string | null;
  email: string | null;
  accessStatus: string;
};

export function AccessStatusCard({ user, disabled = false }: { user: StatusUser; disabled?: boolean }) {
  const clerk = useClerk();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/status", { cache: "no-store" });
      const data = await response.json();
      if (data.accessStatus === "approved") router.replace("/");
      else if (data.accessStatus === "rejected" || data.accessStatus === "suspended") router.replace("/account-disabled");
      else setMessage("Approval is still pending.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="text-center">
      <span className={disabled ? "mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-700" : "mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700"}>
        {disabled ? <ShieldX className="h-6 w-6" /> : <Clock3 className="h-6 w-6" />}
      </span>
      <h2 className="mt-5 text-2xl font-semibold">{disabled ? "This account does not currently have access" : "Your account is waiting for approval"}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {disabled ? `Your account is ${user.accessStatus}. Contact an application owner if you believe this is a mistake.` : "Your email is verified. An owner must approve your account before you can use the portfolio dashboard."}
      </p>
      <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4 text-left">
        <div className="text-sm font-semibold text-slate-900">{user.displayName || user.username || "Portfolio user"}</div>
        {user.username ? <div className="mt-1 text-xs text-slate-500">@{user.username}</div> : null}
        <div className="mt-1 text-xs text-slate-500">{user.email || "Verified email unavailable"}</div>
      </div>
      {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {!disabled ? <button type="button" onClick={refresh} disabled={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50">{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}Refresh status</button> : null}
        <button type="button" onClick={() => clerk.signOut({ redirectUrl: "/sign-in" })} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"><LogOut className="h-4 w-4" />Sign out</button>
      </div>
    </div>
  );
}
