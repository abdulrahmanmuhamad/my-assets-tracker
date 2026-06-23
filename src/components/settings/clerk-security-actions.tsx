"use client";

import { LogOut, UserCog } from "lucide-react";
import { SignOutButton, useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function ClerkSecurityActions() {
  const clerk = useClerk();
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => clerk.openUserProfile()} icon={<UserCog className="h-4 w-4" />}>
        Manage Account
      </Button>
      <SignOutButton>
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </SignOutButton>
    </div>
  );
}
