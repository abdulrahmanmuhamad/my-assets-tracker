import { getDashboardSummary } from "@/lib/data";
import { jsonError, jsonOk } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk(await getDashboardSummary());
  } catch (error) {
    return jsonError(error, 500);
  }
}

