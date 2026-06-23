import { createJewelry, listJewelry } from "@/lib/data";
import { jsonError, jsonOk } from "@/lib/api";
import { jewelryInputSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk(await listJewelry());
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    const input = jewelryInputSchema.parse(await request.json());
    return jsonOk(await createJewelry(input), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

