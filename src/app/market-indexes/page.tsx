import { MarketIndexesWorkspace } from "@/components/market-indexes/market-indexes-workspace";
import { requireApprovedPageUser } from "@/lib/page-auth";
import { getMarketIndexes } from "@/lib/market-data/index-prices";

export const dynamic = "force-dynamic";

export default async function MarketIndexesPage() {
  await requireApprovedPageUser();
  const quotes = await getMarketIndexes(true).catch(() => []);
  return <MarketIndexesWorkspace initialQuotes={quotes} />;
}
