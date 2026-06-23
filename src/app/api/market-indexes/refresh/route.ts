import { requireUser } from "@/lib/auth";
import { refreshMarketIndexes } from "@/lib/market-data/index-prices";
import { jsonError, jsonOk } from "@/lib/api";
import { marketIndexRefreshSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    await requireUser();
    const body = await request.json().catch(() => ({}));
    const input = marketIndexRefreshSchema.parse(body);
    return jsonOk(await refreshMarketIndexes(input.symbols));
  } catch (error) {
    return jsonError(error, 500);
  }
}
