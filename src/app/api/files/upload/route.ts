import { createAssetFile } from "@/lib/data";
import { jsonError, jsonOk } from "@/lib/api";
import { storeUpload } from "@/lib/file-storage";
import { fileUploadFieldsSchema, validateMimeType } from "@/lib/validators";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("File is required");
    }

    if (!validateMimeType(file.type)) {
      throw new Error("Only JPG, PNG, WEBP, and PDF files are allowed");
    }

    const fields = fileUploadFieldsSchema.parse({
      assetType: formData.get("assetType"),
      assetId: formData.get("assetId"),
      fileType: formData.get("fileType"),
    });

    const user = await getCurrentUser();
    const stored = await storeUpload(user.id, file);
    const record = await createAssetFile({
      ...fields,
      fileUrl: stored.relativePath,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: stored.sizeBytes,
    });

    return jsonOk(record, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

