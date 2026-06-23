import { getSettings, updateSettings } from "@/lib/data";
import { jsonError, jsonOk } from "@/lib/api";
import { settingsSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk(await getSettings());
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const input = settingsSchema.parse(await request.json());
    return jsonOk(await updateSettings(input));
  } catch (error) {
    return jsonError(error);
  }
}

