import { deleteRealEstate, listRealEstate, updateRealEstate } from "@/lib/data";
import { jsonError, jsonOk } from "@/lib/api";
import { realEstateInputSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    const asset = (await listRealEstate()).find((item) => item.id === id);
    return asset ? jsonOk(asset) : jsonError(new Error("Property not found"), 404);
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function PUT(request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    const input = realEstateInputSchema.parse(await request.json());
    return jsonOk(await updateRealEstate(id, input));
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    await deleteRealEstate(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

