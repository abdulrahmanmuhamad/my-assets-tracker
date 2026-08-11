import { SettingsPanel } from "@/components/settings/settings-panel";
import { getSettings } from "@/lib/data";
import { requireApprovedPageUser } from "@/lib/page-auth";
import { getStocksPortfolio } from "@/services/brokerage/syncService";
import { getNotificationPreferences } from "@/lib/alerts/repository";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireApprovedPageUser();
  const [settings, stocks, notificationPreferences] = await Promise.all([
    getSettings(),
    getStocksPortfolio(user.id),
    getNotificationPreferences(user.id, user.email, user.phone),
  ]);
  return (
    <SettingsPanel
      initialSettings={settings}
      securityUser={{
        email: user.email,
        phone: user.phone,
        name: user.name,
        imageUrl: user.imageUrl,
        username: user.username,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        accessStatus: user.accessStatus,
        role: user.role,
      }}
      initialBrokerageConnections={stocks.connections}
      initialNotificationPreferences={notificationPreferences}
      developerReadiness={user.role === "owner" ? {
        clerk: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY),
        ownerEmails: Boolean(process.env.OWNER_EMAILS?.trim()),
        clerkWebhook: Boolean(process.env.CLERK_WEBHOOK_SECRET),
        providerConnections: true,
        tokenEncryption: Boolean(process.env.TOKEN_ENCRYPTION_KEY),
        resend: Boolean(process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL),
        alerts: Boolean(process.env.ALERTS_EVALUATION_SECRET || process.env.CRON_SECRET),
      } : undefined}
    />
  );
}
