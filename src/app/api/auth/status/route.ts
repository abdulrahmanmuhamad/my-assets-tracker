import { jsonError, jsonOk } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    return jsonOk({
      authenticated: true,
      email: user.email,
      emailVerified: user.emailVerified,
      username: user.username,
      displayName: user.displayName,
      accessStatus: user.accessStatus,
      role: user.role,
    });
  } catch (error) {
    return jsonError(error, 500);
  }
}
