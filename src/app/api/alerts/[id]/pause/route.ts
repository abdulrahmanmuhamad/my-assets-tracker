import { requireUser } from "@/lib/auth";
import { setAlertRuleStatus } from "@/lib/alerts/repository";
import { jsonError, jsonOk } from "@/lib/api";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    return jsonOk(await setAlertRuleStatus(user.id, id, "paused"));
  } catch (error) {
    return jsonError(error);
  }
}
