import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { snapTradeConnectSchema } from "@/lib/validators";
import { createSnapTradeConnectionPortal } from "@/services/brokerage/syncService";

function stocksRedirect(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new Error("NEXT_PUBLIC_APP_URL is required for SnapTrade in production");
  }
  try {
    const target = new URL("/stocks", configured || requestOrigin);
    if (process.env.NODE_ENV === "production" && target.protocol !== "https:") {
      throw new Error("SnapTrade requires an HTTPS production redirect URL");
    }
    return target.toString();
  } catch {
    throw new Error("NEXT_PUBLIC_APP_URL is invalid for SnapTrade redirects");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = snapTradeConnectSchema.parse(await request.json());
    return jsonOk(await createSnapTradeConnectionPortal(
      user.id,
      input.clientId && input.consumerKey ? { clientId: input.clientId, consumerKey: input.consumerKey } : null,
      stocksRedirect(request),
      input.connectionId,
    ));
  } catch (error) {
    return jsonError(error);
  }
}
