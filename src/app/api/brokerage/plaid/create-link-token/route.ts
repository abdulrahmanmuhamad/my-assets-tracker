import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createLinkTokenSchema } from "@/lib/validators";
import { createBrokerageLinkToken } from "@/services/brokerage/syncService";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = createLinkTokenSchema.parse(await request.json().catch(() => ({})));
    const token = await createBrokerageLinkToken(user.id, input.provider);
    return jsonOk(token);
  } catch (error) {
    return jsonError(error);
  }
}
