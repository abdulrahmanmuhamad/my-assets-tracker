import { requireUser } from "@/lib/auth";
import { createAlertRule, listAlertRules } from "@/lib/alerts/repository";
import { jsonError, jsonOk } from "@/lib/api";
import { alertRuleInputSchema } from "@/lib/validators";
import { requireAlertCategoryEnabled } from "@/lib/features";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const search = new URL(request.url).searchParams;
    return jsonOk(
      await listAlertRules(user.id, {
        status: search.get("status") || undefined,
        assetCategory: search.get("assetCategory") || undefined,
        alertType: search.get("alertType") || undefined,
        assetId: search.get("assetId") || undefined,
      }),
    );
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = alertRuleInputSchema.parse(await request.json());
    requireAlertCategoryEnabled(input.assetCategory);
    return jsonOk(await createAlertRule(user.id, input), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
