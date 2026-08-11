import { requireApprovedPageUser } from "@/lib/page-auth";
import { getBanksPortfolio } from "@/lib/banks/bank-sync-service";
import { BanksWorkspace } from "@/components/banks/banks-workspace";

export const dynamic = "force-dynamic";

export default async function BanksPage() {
  const user = await requireApprovedPageUser();
  return <BanksWorkspace initialPortfolio={await getBanksPortfolio(user.id)} />;
}
