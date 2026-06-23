import { updateUserAccess } from "@/lib/admin-access";
import { jsonError, jsonOk } from "@/lib/api";
import { requireOwnerOrAdmin } from "@/lib/auth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOwnerOrAdmin();
    const { id } = await params;
    return jsonOk(await updateUserAccess(actor, id, "suspend"));
  } catch (error) {
    return jsonError(error);
  }
}
