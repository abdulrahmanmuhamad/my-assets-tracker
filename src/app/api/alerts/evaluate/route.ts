import { evaluateAllAlerts } from "@/lib/alerts/evaluate-alerts";
import { isEvaluationRequestAuthorized } from "@/lib/alerts/evaluation-auth";
import { jsonError, jsonOk } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validSecret(request: Request) {
  return isEvaluationRequestAuthorized(request.headers.get("authorization"), [
    process.env.ALERTS_EVALUATION_SECRET,
    process.env.CRON_SECRET,
  ]);
}

export async function POST(request: Request) {
  try {
    if (!process.env.ALERTS_EVALUATION_SECRET && !process.env.CRON_SECRET) {
      return jsonError(new Error("Alert evaluation is not configured"), 503);
    }
    if (!validSecret(request)) return jsonError(new Error("Unauthorized"), 401);
    const result = await evaluateAllAlerts();
    return jsonOk({ ok: true, checked: result.checked, triggered: result.triggered, failed: result.failed });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export const GET = POST;
