import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getBankTransactions } from "@/lib/banks/bank-sync-service";

export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk(await getBankTransactions(user.id));
  } catch (error) {
    return jsonError(error);
  }
}
