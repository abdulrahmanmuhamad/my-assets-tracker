import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk({
      id: user.id,
      authProviderUserId: user.authProviderUserId,
      email: user.email,
      phone: user.phone,
      name: user.name,
      imageUrl: user.imageUrl,
    });
  } catch (error) {
    return jsonError(error);
  }
}
