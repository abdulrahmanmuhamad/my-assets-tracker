import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getStocksPortfolio } from "@/services/brokerage/syncService";

type RouteParams = { params: Promise<{ accountId: string }> };

export async function GET(_request: Request, context: RouteParams) {
  try {
    const user = await requireUser();
    const { accountId } = await context.params;
    const portfolio = await getStocksPortfolio(user.id);
    const account = portfolio.accounts.find((item) => item.id === accountId);
    if (!account) return jsonError(new Error("Brokerage account not found"), 404);

    return jsonOk({
      account,
      holdings: portfolio.holdings.filter((holding) => holding.brokerageAccountId === accountId),
      transactions: portfolio.transactions.filter((transaction) => transaction.brokerageAccountId === accountId),
    });
  } catch (error) {
    return jsonError(error);
  }
}
