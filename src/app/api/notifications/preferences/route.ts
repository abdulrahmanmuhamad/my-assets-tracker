import { requireUser } from "@/lib/auth";
import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/alerts/repository";
import { jsonError, jsonOk } from "@/lib/api";
import { notificationPreferencesSchema } from "@/lib/validators";

export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk(await getNotificationPreferences(user.id, user.email, user.phone));
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const input = notificationPreferencesSchema.parse(await request.json());
    return jsonOk(await updateNotificationPreferences(user.id, input));
  } catch (error) {
    return jsonError(error);
  }
}
