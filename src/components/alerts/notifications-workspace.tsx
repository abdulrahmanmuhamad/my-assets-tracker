"use client";

import { useMemo, useState } from "react";
import { Bell, CheckCheck, ExternalLink, MailOpen, Trash2 } from "lucide-react";
import type { AlertEventRecord } from "@/lib/alerts/client-types";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, MetricCard } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/patterns";
import { formatDisplayDate, titleFromSnake } from "@/lib/utils";

function assetHref(event: AlertEventRecord) {
  if (event.assetCategory === "mineral") return "/minerals";
  if (event.assetCategory === "jewelry") return "/jewelry";
  if (event.assetCategory === "real_estate") return "/real-estate";
  if (event.assetCategory === "market_index") return "/market-indexes";
  return "/stocks";
}

export function NotificationsWorkspace({ initialEvents }: { initialEvents: AlertEventRecord[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [view, setView] = useState("all");
  const [pending, setPending] = useState(false);
  const visible = useMemo(() => events.filter((event) => view === "all" || (view === "unread" ? !event.readAt : Boolean(event.readAt))), [events, view]);
  const unread = events.filter((event) => !event.readAt).length;

  async function markRead(id: string) {
    const response = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    if (response.ok) {
      const data = await response.json();
      setEvents((current) => current.map((event) => (event.id === id ? data : event)));
    }
  }

  async function markAll() {
    setPending(true);
    try {
      const response = await fetch("/api/notifications/read-all", { method: "POST" });
      if (response.ok) setEvents((current) => current.map((event) => ({ ...event, readAt: event.readAt || new Date().toISOString() })));
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    const response = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    if (response.ok) setEvents((current) => current.filter((event) => event.id !== id));
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Notification center" title="Notifications" subtitle="Triggered alert history, read state, delivery channels, and delivery outcomes." actions={<><LinkButton href="/alerts" icon={<Bell className="h-4 w-4" />}>Manage Alerts</LinkButton><Button onClick={markAll} disabled={pending || !unread} icon={<CheckCheck className="h-4 w-4" />}>Mark All Read</Button></>} />
      <div className="grid gap-3 md:grid-cols-3"><MetricCard label="Unread" value={unread} detail="Needs review" tone="warning" /><MetricCard label="Read" value={events.length - unread} detail="Reviewed history" tone="positive" /><MetricCard label="Total events" value={events.length} detail="Alert trigger history" tone="info" /></div>
      <Card><CardContent className="flex gap-2"><Button variant={view === "all" ? "primary" : "secondary"} onClick={() => setView("all")}>All</Button><Button variant={view === "unread" ? "primary" : "secondary"} onClick={() => setView("unread")}>Unread</Button><Button variant={view === "read" ? "primary" : "secondary"} onClick={() => setView("read")}>Read</Button></CardContent></Card>
      <Card>
        <CardHeader><h2 className="text-base font-semibold text-slate-950">Alert history</h2></CardHeader>
        <div className="divide-y divide-slate-100">
          {visible.map((event) => (
            <div key={event.id} className={event.readAt ? "grid gap-3 px-5 py-4 lg:grid-cols-[1fr_180px_auto] lg:items-center" : "grid gap-3 bg-sky-50/40 px-5 py-4 lg:grid-cols-[1fr_180px_auto] lg:items-center"}>
              <div>
                <div className="flex flex-wrap items-center gap-2"><div className="font-semibold text-slate-950">{event.eventTitle}</div>{!event.readAt ? <Badge tone="info">Unread</Badge> : null}<Badge tone={event.deliveryStatus === "sent" ? "positive" : event.deliveryStatus === "partial" ? "warning" : event.deliveryStatus === "failed" ? "negative" : "neutral"}>{titleFromSnake(event.deliveryStatus)}</Badge></div>
                <div className="mt-1 text-sm text-slate-600">{event.eventMessage}</div>
                <div className="mt-2 text-xs text-slate-400">{event.alertName} · {event.notificationChannels.map(titleFromSnake).join(", ")}</div>
              </div>
              <div className="text-sm text-slate-500">{formatDisplayDate(event.createdAt)}</div>
              <div className="flex justify-end gap-1">
                <LinkButton href={assetHref(event)} size="icon" title="Open related asset" aria-label="Open related asset"><ExternalLink className="h-4 w-4" /></LinkButton>
                {!event.readAt ? <Button variant="ghost" size="icon" title="Mark as read" aria-label="Mark as read" onClick={() => markRead(event.id)}><MailOpen className="h-4 w-4" /></Button> : null}
                <Button variant="ghost" size="icon" title="Delete notification" aria-label="Delete notification" onClick={() => remove(event.id)}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
              </div>
            </div>
          ))}
          {!visible.length ? <div className="p-6"><EmptyState title="No notifications" description="Triggered alerts will appear here with delivery status and links to related assets." /></div> : null}
        </div>
      </Card>
    </div>
  );
}
