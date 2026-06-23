import { requireApprovedPageUser } from "@/lib/page-auth";
import { getStocksPortfolio } from "@/services/brokerage/syncService";
import { StocksWorkspace } from "@/components/stocks/stocks-workspace";
import { FeatureComingSoonOverlay } from "@/components/features/feature-coming-soon-overlay";
import { isStocksFeatureEnabled } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function StocksPage() {
  const user = await requireApprovedPageUser();
  const portfolio = await getStocksPortfolio(user.id);

  const workspace = <StocksWorkspace initialPortfolio={portfolio} />;
  return isStocksFeatureEnabled() ? workspace : (
    <FeatureComingSoonOverlay
      featureName="Stocks"
      description="Brokerage account syncing is being prepared and will be available after provider approval."
      badgeText="Plaid approval pending"
    >
      {workspace}
    </FeatureComingSoonOverlay>
  );
}
