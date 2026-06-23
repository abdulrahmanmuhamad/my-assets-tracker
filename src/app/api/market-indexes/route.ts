import { requireUser } from "@/lib/auth";
import { getMarketIndexes } from "@/lib/market-data/index-prices";
import { jsonError, jsonOk } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    return jsonOk(await getMarketIndexes(true));
  } catch (error) {
    return jsonError(error, 500);
  }
}
