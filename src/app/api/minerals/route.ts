import { createMineral, listMinerals } from "@/lib/data";
import { jsonError, jsonOk } from "@/lib/api";
import { mineralInputSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk(await listMinerals());
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    const input = mineralInputSchema.parse(await request.json());
    return jsonOk(await createMineral(input), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

