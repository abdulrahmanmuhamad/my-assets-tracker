import { requireUser } from "@/lib/auth";
import { deleteAlertRule, getAlertRule, updateAlertRule } from "@/lib/alerts/repository";
import { jsonError, jsonOk } from "@/lib/api";
import { alertRuleInputSchema } from "@/lib/validators";
import { requireAlertCategoryEnabled } from "@/lib/features";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteParams) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const rule = await getAlertRule(user.id, id);
    return rule ? jsonOk(rule) : jsonError(new Error("Alert rule not found"), 404);
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function PUT(request: Request, context: RouteParams) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const input = alertRuleInputSchema.parse(await request.json());
    requireAlertCategoryEnabled(input.assetCategory);
    return jsonOk(await updateAlertRule(user.id, id, input));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: RouteParams) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteAlertRule(user.id, id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
