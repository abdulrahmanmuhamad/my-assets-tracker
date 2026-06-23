import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { syncBrokerageSchema } from "@/lib/validators";
import { syncAllBrokerageConnections, syncBrokerageConnection } from "@/services/brokerage/syncService";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = syncBrokerageSchema.parse(await request.json().catch(() => ({})));
    const result = input.connectionId
      ? await syncBrokerageConnection(user.id, input.connectionId)
      : await syncAllBrokerageConnections(user.id);
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
