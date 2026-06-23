"use client";

import { useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { ExternalLink, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export type ProfileUser = {
  username: string | null;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
};

export function ProfileSettings({ initialUser, clerkConfigured }: { initialUser: ProfileUser; clerkConfigured: boolean }) {
  const [username, setUsername] = useState(initialUser.username || "");
  const [displayName, setDisplayName] = useState(initialUser.displayName || "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Profile update failed");
      setUsername(data.username || "");
      setDisplayName(data.displayName || "");
      window.dispatchEvent(new CustomEvent("portfolio:profile-updated", { detail: data }));
      setMessage("Profile updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profile update failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader><h2 className="text-base font-semibold text-slate-950">Profile</h2></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Username<input className="h-10 rounded-md border border-slate-200 px-3 text-sm" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={30} /></label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">Display name<input className="h-10 rounded-md border border-slate-200 px-3 text-sm" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} /></label>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Current verified email</div>
          <div className="mt-1 text-sm font-semibold text-slate-950">{initialUser.email || "Not available"}</div>
          <p className="mt-2 text-xs leading-5 text-slate-500">Email changes are managed by Clerk. A new address must be verified before it becomes the local primary email.</p>
        </div>
        {message ? <div className="text-sm text-slate-600">{message}</div> : null}
        <div className="flex flex-wrap gap-3">
          <Button onClick={save} disabled={pending} icon={<Save className="h-4 w-4" />}>{pending ? "Saving…" : "Save profile"}</Button>
          {clerkConfigured ? <ManageClerkAccountButton /> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ManageClerkAccountButton() {
  const clerk = useClerk();
  return <Button variant="secondary" onClick={() => clerk.openUserProfile()} icon={<ExternalLink className="h-4 w-4" />}>Manage account and email</Button>;
}
