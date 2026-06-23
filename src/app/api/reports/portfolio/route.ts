import { flattenPortfolioAssets, getDashboardSummary, getPortfolioCollections } from "@/lib/data";
import { jsonError, jsonOk } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const collections = await getPortfolioCollections();
    const assets = flattenPortfolioAssets(collections);
    return jsonOk({
      summary: await getDashboardSummary(),
      assets,
      collections,
    });
  } catch (error) {
    return jsonError(error, 500);
  }
}

