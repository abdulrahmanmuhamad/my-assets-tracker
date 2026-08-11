import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { connectSimpleFin } from "@/lib/banks/bank-sync-service";
import { simpleFinConnectSchema } from "@/lib/validators";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = simpleFinConnectSchema.parse(await request.json());
    return jsonOk(await connectSimpleFin(user.id, input.setupToken), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
