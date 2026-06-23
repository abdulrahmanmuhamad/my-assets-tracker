import { requireUser } from "@/lib/auth";
import { deleteNotification } from "@/lib/alerts/repository";
import { jsonError, jsonOk } from "@/lib/api";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await deleteNotification(user.id, id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
