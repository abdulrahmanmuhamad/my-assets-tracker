import { isEvaluationRequestAuthorized } from "@/lib/alerts/evaluation-auth";
import { jsonError, jsonOk } from "@/lib/api";
import { syncAllConfiguredProviders } from "@/lib/providers/scheduled-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request) {
  return isEvaluationRequestAuthorized(request.headers.get("authorization"), [process.env.CRON_SECRET]);
}

export async function POST(request: Request) {
  try {
    if (!process.env.CRON_SECRET) return jsonError(new Error("Provider synchronization is not configured"), 503);
    if (!authorized(request)) return jsonError(new Error("Unauthorized"), 401);
    return jsonOk({ ok: true, ...await syncAllConfiguredProviders() });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export const GET = POST;
