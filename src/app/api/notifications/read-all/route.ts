import { requireUser } from "@/lib/auth";
import { markAllNotificationsRead } from "@/lib/alerts/repository";
import { jsonError, jsonOk } from "@/lib/api";

export async function POST() {
  try {
    const user = await requireUser();
    return jsonOk({ updated: await markAllNotificationsRead(user.id) });
  } catch (error) {
    return jsonError(error);
  }
}
