import { jsonError, jsonOk } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { usernameSchema } from "@/lib/user-access";

export async function POST(request: Request) {
  try {
    const { username } = await request.json();
    const normalized = usernameSchema.parse(username);
    const existing = await prisma.user.findUnique({ where: { username: normalized }, select: { id: true } });
    return jsonOk({ available: !existing, username: normalized });
  } catch (error) {
    return jsonError(error);
  }
}
