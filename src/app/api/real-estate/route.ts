import { createRealEstate, listRealEstate } from "@/lib/data";
import { jsonError, jsonOk } from "@/lib/api";
import { realEstateInputSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk(await listRealEstate());
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    const input = realEstateInputSchema.parse(await request.json());
    return jsonOk(await createRealEstate(input), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

