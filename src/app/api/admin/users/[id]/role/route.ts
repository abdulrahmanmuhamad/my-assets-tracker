import { z } from "zod";
import { changeUserRole } from "@/lib/admin-access";
import { jsonError, jsonOk } from "@/lib/api";
import { requireOwner } from "@/lib/auth";

const roleSchema = z.object({ role: z.enum(["user", "admin"]) });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireOwner();
    const { id } = await params;
    const { role } = roleSchema.parse(await request.json());
    return jsonOk(await changeUserRole(actor, id, role));
  } catch (error) {
    return jsonError(error);
  }
}
