import { deleteAssetFile, getAssetFile } from "@/lib/data";
import { jsonError, jsonOk } from "@/lib/api";
import { readStoredFile } from "@/lib/file-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    const file = await getAssetFile(id);
    if (!file) {
      return jsonError(new Error("File not found"), 404);
    }

    const bytes = await readStoredFile(file);
    return new Response(bytes, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${file.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function DELETE(_request: Request, context: RouteParams) {
  try {
    const { id } = await context.params;
    await deleteAssetFile(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

