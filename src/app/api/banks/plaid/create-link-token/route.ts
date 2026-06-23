import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createBankLinkToken } from "@/lib/banks/plaid-bank-provider";

export async function POST() {
  try {
    const user = await requireUser();
    return jsonOk(await createBankLinkToken(user.id));
  } catch (error) {
    return jsonError(error);
  }
}
