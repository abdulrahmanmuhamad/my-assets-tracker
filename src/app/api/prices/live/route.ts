import { autoRefreshPricesIfStale } from "@/lib/prices";
import { jsonError, jsonOk } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk(await autoRefreshPricesIfStale());
  } catch (error) {
    return jsonError(error, 500);
  }
}

