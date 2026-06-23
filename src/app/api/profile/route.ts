import { Prisma } from "@prisma/client";
import { jsonError, jsonOk } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileUpdateSchema } from "@/lib/user-access";

const profileSelect = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  emailVerified: true,
  phone: true,
  imageUrl: true,
  accessStatus: true,
  role: true,
} as const;

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    return jsonOk(await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: profileSelect }));
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const input = profileUpdateSchema.parse(await request.json());
    return jsonOk(await prisma.user.update({
      where: { id: user.id },
      data: { username: input.username, displayName: input.displayName || null },
      select: profileSelect,
    }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(new Error("That username is already in use"), 409);
    }
    return jsonError(error);
  }
}
