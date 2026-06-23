import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { syncBankConnection } from "@/lib/banks/bank-sync-service";

export async function POST(_request: Request, { params }: { params: Promise<{ connectionId: string }> }) {
  try {
    const user = await requireUser();
    const { connectionId } = await params;
    return jsonOk(await syncBankConnection(user.id, connectionId));
  } catch (error) {
    return jsonError(error);
  }
}
