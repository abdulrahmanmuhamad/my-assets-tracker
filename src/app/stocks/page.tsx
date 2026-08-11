import { requireApprovedPageUser } from "@/lib/page-auth";
import { getStocksPortfolio } from "@/services/brokerage/syncService";
import { StocksWorkspace } from "@/components/stocks/stocks-workspace";

export const dynamic = "force-dynamic";

export default async function StocksPage() {
  const user = await requireApprovedPageUser();
  const portfolio = await getStocksPortfolio(user.id);
  return <StocksWorkspace initialPortfolio={portfolio} />;
}
