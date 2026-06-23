import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { exchangePublicTokenSchema } from "@/lib/validators";
import { exchangePlaidPublicToken } from "@/services/brokerage/syncService";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = exchangePublicTokenSchema.parse(await request.json());
    const connection = await exchangePlaidPublicToken(user.id, input.publicToken);
    return jsonOk(connection, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
