import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { syncBrokerageConnection } from "@/services/brokerage/syncService";

export async function POST(_request: Request, { params }: { params: Promise<{ connectionId: string }> }) {
  try {
    const user = await requireUser();
    const { connectionId } = await params;
    return jsonOk(await syncBrokerageConnection(user.id, connectionId));
  } catch (error) {
    return jsonError(error);
  }
}
