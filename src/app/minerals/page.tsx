import { AssetsWorkspace } from "@/components/assets/assets-workspace";
import { MINERAL_TYPES } from "@/lib/constants";
import { getPortfolioCollections } from "@/lib/data";
import { requireApprovedPageUser } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function MineralsPage() {
  await requireApprovedPageUser();
  const collections = await getPortfolioCollections();

  return (
    <AssetsWorkspace
      mode="minerals"
      title="Minerals"
      subtitle="Gold, silver, platinum, palladium, copper, and other mineral transactions with live price valuation."
      tabs={MINERAL_TYPES}
      initialAssets={collections.minerals}
    />
  );
}
