"use client";

import { useEffect, useState } from "react";
import { Check, RotateCcw, ShieldAlert, UserRoundX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type AccessUser = {
  id: string;
  username: string | null;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  accessStatus: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
};

const sections = [
  ["pending_owner_approval", "Pending Approval"],
  ["approved", "Approved Users"],
  ["rejected", "Rejected Users"],
  ["suspended", "Suspended Users"],
] as const;

export function UserAccessSettings({ actorRole }: { actorRole: string }) {
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [pendingId, setPendingId] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load users");
    setUsers(data);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/users", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load users");
        return data;
      })
      .then((data) => { if (!cancelled) setUsers(data); })
      .catch((error) => { if (!cancelled) setMessage(error.message); });
    return () => { cancelled = true; };
  }, []);

  async function act(id: string, action: string, body?: object) {
    setPendingId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${id}/${action}`, {
        method: action === "role" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Access update failed");
      await load();
      setMessage("User access updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Access update failed");
    } finally {
      setPendingId("");
    }
  }

  return (
    <div className="space-y-4 xl:col-span-2">
      {message ? <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{message}</div> : null}
      {sections.map(([status, label]) => {
        const rows = users.filter((user) => status === "pending_owner_approval"
          ? user.accessStatus === "pending_owner_approval" || user.accessStatus === "pending_email_verification"
          : user.accessStatus === status);
        return (
          <Card key={status}>
            <CardHeader className="flex flex-row items-center justify-between"><h2 className="text-base font-semibold text-slate-950">{label}</h2><Badge>{rows.length}</Badge></CardHeader>
            <CardContent className="space-y-3">
              {rows.map((user) => (
                <div key={user.id} className="grid gap-4 rounded-md border border-slate-200 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-950">{user.displayName || user.username || "Unnamed user"}</span><Badge tone={user.emailVerified ? "positive" : "warning"}>{user.emailVerified ? "Email verified" : "Unverified"}</Badge><Badge>{user.accessStatus.replaceAll("_", " ")}</Badge><Badge>{user.role}</Badge></div>
                    <div className="mt-1 text-sm text-slate-600">{user.username ? `@${user.username} · ` : ""}{user.email || "No verified email"}</div>
                    <div className="mt-2 text-xs text-slate-500">Joined {new Date(user.createdAt).toLocaleDateString()} · Last login {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {status === "pending_owner_approval" ? <><Button size="sm" disabled={pendingId === user.id || !user.emailVerified} onClick={() => act(user.id, "approve")} icon={<Check className="h-4 w-4" />}>Approve</Button><Button size="sm" variant="danger" disabled={pendingId === user.id} onClick={() => act(user.id, "reject")} icon={<UserRoundX className="h-4 w-4" />}>Reject</Button></> : null}
                    {status === "approved" ? <Button size="sm" variant="danger" disabled={pendingId === user.id} onClick={() => act(user.id, "suspend")} icon={<ShieldAlert className="h-4 w-4" />}>Suspend</Button> : null}
                    {status === "rejected" || status === "suspended" ? <Button size="sm" disabled={pendingId === user.id} onClick={() => act(user.id, "restore")} icon={<RotateCcw className="h-4 w-4" />}>Restore</Button> : null}
                    {actorRole === "owner" && user.role !== "owner" && status === "approved" ? <select className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm" value={user.role} disabled={pendingId === user.id} onChange={(event) => act(user.id, "role", { role: event.target.value })}><option value="user">User</option><option value="admin">Admin</option></select> : null}
                  </div>
                </div>
              ))}
              {!rows.length ? <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No users in this section.</div> : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
