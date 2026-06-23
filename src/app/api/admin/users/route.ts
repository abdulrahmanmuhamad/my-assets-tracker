import { jsonError, jsonOk } from "@/lib/api";
import { requireOwnerOrAdmin } from "@/lib/auth";
import { adminUserSelect } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireOwnerOrAdmin();
    return jsonOk(await prisma.user.findMany({ select: adminUserSelect, orderBy: [{ accessStatus: "asc" }, { createdAt: "desc" }] }));
  } catch (error) {
    return jsonError(error, 500);
  }
}
