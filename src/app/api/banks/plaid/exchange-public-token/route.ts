import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { exchangeBankPublicToken } from "@/lib/banks/bank-sync-service";
import { exchangePublicTokenSchema } from "@/lib/validators";
import { requirePlaidFeatureEnabled } from "@/lib/features";

export async function POST(request: Request) {
  try {
    requirePlaidFeatureEnabled();
    const user = await requireUser();
    const input = exchangePublicTokenSchema.parse(await request.json());
    return jsonOk(await exchangeBankPublicToken(user.id, input.publicToken), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
