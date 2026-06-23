import { NotificationsWorkspace } from "@/components/alerts/notifications-workspace";
import { listNotifications } from "@/lib/alerts/repository";
import { requireApprovedPageUser } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireApprovedPageUser();
  return <NotificationsWorkspace initialEvents={await listNotifications(user.id)} />;
}
