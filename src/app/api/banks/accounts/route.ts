import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getBanksPortfolio } from "@/lib/banks/bank-sync-service";

export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk((await getBanksPortfolio(user.id)).accounts);
  } catch (error) {
    return jsonError(error);
  }
}
