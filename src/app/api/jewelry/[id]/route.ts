import { deleteJewelry, listJewelry, updateJewelry } from "@/lib/data";
import { jsonError, jsonOk } from "@/lib/api";
import { jewelryInputSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    const asset = (await listJewelry()).find((item) => item.id === id);
    return asset ? jsonOk(asset) : jsonError(new Error("Jewelry item not found"), 404);
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function PUT(request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    const input = jewelryInputSchema.parse(await request.json());
    return jsonOk(await updateJewelry(id, input));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    await deleteJewelry(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

