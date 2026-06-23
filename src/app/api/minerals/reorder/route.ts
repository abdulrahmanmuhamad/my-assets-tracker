import { reorderAssets } from "@/lib/data";
import { jsonError, jsonOk } from "@/lib/api";
import { reorderSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { orderedIds } = reorderSchema.parse(await request.json());
    await reorderAssets("mineral", orderedIds);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

