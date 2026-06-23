import { AssetsWorkspace } from "@/components/assets/assets-workspace";
import { JEWELRY_TYPES } from "@/lib/constants";
import { getPortfolioCollections } from "@/lib/data";
import { requireApprovedPageUser } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function JewelryPage() {
  await requireApprovedPageUser();
  const collections = await getPortfolioCollections();

  return (
    <AssetsWorkspace
      mode="jewelry"
      title="Jewelry"
      subtitle="Gold, silver, gemstones, gold plated pieces, photos, receipts, certificates, and valuation notes."
      tabs={JEWELRY_TYPES}
      initialAssets={collections.jewelry}
    />
  );
}
