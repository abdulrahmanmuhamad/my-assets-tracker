import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { disconnectBrokerageSchema } from "@/lib/validators";
import { disconnectBrokerageConnection } from "@/services/brokerage/syncService";

type RouteParams = { params: Promise<{ connectionId: string }> };

export async function DELETE(request: Request, context: RouteParams) {
  try {
    const user = await requireUser();
    const { connectionId } = await context.params;
    const input = disconnectBrokerageSchema.parse(await request.json().catch(() => ({})));
    return jsonOk(await disconnectBrokerageConnection(user.id, connectionId, input.deleteData));
  } catch (error) {
    return jsonError(error);
  }
}
