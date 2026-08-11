import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { syncAllBankConnections } from "@/lib/banks/bank-sync-service";

export const maxDuration = 60;

export async function POST() {
  try {
    const user = await requireUser();
    return jsonOk(await syncAllBankConnections(user.id));
  } catch (error) {
    return jsonError(error);
  }
}
