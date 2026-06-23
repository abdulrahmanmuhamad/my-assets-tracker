import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getStocksPortfolio } from "@/services/brokerage/syncService";

export async function GET() {
  try {
    const user = await requireUser();
    const portfolio = await getStocksPortfolio(user.id);
    return jsonOk(portfolio.transactions);
  } catch (error) {
    return jsonError(error);
  }
}
