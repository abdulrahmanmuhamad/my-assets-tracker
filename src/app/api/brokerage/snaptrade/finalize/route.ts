import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { finalizeSnapTradeConnections } from "@/services/brokerage/syncService";

export const maxDuration = 60;

export async function POST() {
  try {
    const user = await requireUser();
    return jsonOk(await finalizeSnapTradeConnections(user.id));
  } catch (error) {
    return jsonError(error);
  }
}
