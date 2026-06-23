import { requireUser } from "@/lib/auth";
import { getMarketIndex } from "@/lib/market-data/index-prices";
import { jsonError, jsonOk } from "@/lib/api";

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    await requireUser();
    const { symbol } = await params;
    const quote = await getMarketIndex(decodeURIComponent(symbol), true);
    return quote ? jsonOk(quote) : jsonError(new Error("Market index not found"), 404);
  } catch (error) {
    return jsonError(error, 500);
  }
}
