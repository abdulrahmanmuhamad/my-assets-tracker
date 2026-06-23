import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { disconnectBankConnection } from "@/lib/banks/bank-sync-service";
import { disconnectBrokerageSchema } from "@/lib/validators";

export async function DELETE(request: Request, { params }: { params: Promise<{ connectionId: string }> }) {
  try {
    const user = await requireUser();
    const { connectionId } = await params;
    const input = disconnectBrokerageSchema.parse(await request.json().catch(() => ({})));
    return jsonOk(await disconnectBankConnection(user.id, connectionId, input.deleteData));
  } catch (error) {
    return jsonError(error);
  }
}
