import { refreshLivePrices } from "@/lib/prices";
import { jsonError, jsonOk } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return jsonOk(await refreshLivePrices());
  } catch (error) {
    return jsonError(error, 500);
  }
}

