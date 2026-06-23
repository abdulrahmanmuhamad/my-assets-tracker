import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getStocksPortfolio } from "@/services/brokerage/syncService";

type RouteParams = { params: Promise<{ brokerId: string }> };

export async function GET(_request: Request, context: RouteParams) {
  try {
    const user = await requireUser();
    const { brokerId } = await context.params;
    const portfolio = await getStocksPortfolio(user.id);
    const connection = portfolio.connections.find((item) => item.id === brokerId);
    if (!connection) return jsonError(new Error("Brokerage connection not found"), 404);

    return jsonOk({
      connection,
      accounts: portfolio.accounts.filter((account) => account.brokerageConnectionId === brokerId),
      holdings: portfolio.holdings.filter((holding) => holding.brokerageConnectionId === brokerId),
      transactions: portfolio.transactions.filter((transaction) => transaction.brokerageConnectionId === brokerId),
    });
  } catch (error) {
    return jsonError(error);
  }
}
