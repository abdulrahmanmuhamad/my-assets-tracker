import { requireUser } from "@/lib/auth";
import { listNotifications } from "@/lib/alerts/repository";
import { jsonError, jsonOk } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const unreadOnly = new URL(request.url).searchParams.get("unread") === "true";
    return jsonOk(await listNotifications(user.id, unreadOnly));
  } catch (error) {
    return jsonError(error, 500);
  }
}
