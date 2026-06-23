import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getStocksPortfolio } from "@/services/brokerage/syncService";

export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk(await getStocksPortfolio(user.id));
  } catch (error) {
    return jsonError(error);
  }
}
