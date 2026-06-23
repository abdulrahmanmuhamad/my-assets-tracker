import { AssetsWorkspace } from "@/components/assets/assets-workspace";
import { REAL_ESTATE_TYPES } from "@/lib/constants";
import { getPortfolioCollections } from "@/lib/data";
import { requireApprovedPageUser } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function RealEstatePage() {
  await requireApprovedPageUser();
  const collections = await getPortfolioCollections();

  return (
    <AssetsWorkspace
      mode="real-estate"
      title="Real Estate"
      subtitle="Residential and commercial properties with equity, rental income, expenses, financing, and documents."
      tabs={REAL_ESTATE_TYPES}
      initialAssets={collections.realEstate}
    />
  );
}
