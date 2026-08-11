import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createBankLinkToken } from "@/lib/banks/plaid-bank-provider";
import { requirePlaidFeatureEnabled } from "@/lib/features";

export async function POST() {
  try {
    requirePlaidFeatureEnabled();
    const user = await requireUser();
    return jsonOk(await createBankLinkToken(user.id));
  } catch (error) {
    return jsonError(error);
  }
}
