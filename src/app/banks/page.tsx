import { requireApprovedPageUser } from "@/lib/page-auth";
import { getBanksPortfolio } from "@/lib/banks/bank-sync-service";
import { BanksWorkspace } from "@/components/banks/banks-workspace";
import { FeatureComingSoonOverlay } from "@/components/features/feature-coming-soon-overlay";
import { isBanksFeatureEnabled } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function BanksPage() {
  const user = await requireApprovedPageUser();
  const workspace = <BanksWorkspace initialPortfolio={await getBanksPortfolio(user.id)} />;
  return isBanksFeatureEnabled() ? workspace : (
    <FeatureComingSoonOverlay
      featureName="Banks"
      description="Bank account syncing is being prepared and will be available after provider approval."
      badgeText="Plaid approval pending"
    >
      {workspace}
    </FeatureComingSoonOverlay>
  );
}
