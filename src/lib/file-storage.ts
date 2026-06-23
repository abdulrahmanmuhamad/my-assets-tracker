import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssetFile } from "@prisma/client";

const DEFAULT_MAX_MB = 10;

export function uploadRoot() {
  const configured = process.env.UPLOAD_DIR;
  if (configured && path.isAbsolute(configured)) {
    return configured;
  }

  return path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "uploads");
}

export function maxUploadBytes() {
  const configured = Number(process.env.MAX_UPLOAD_MB || DEFAULT_MAX_MB);
  return Math.max(1, configured) * 1024 * 1024;
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

export function resolveStoredPath(relativePath: string) {
  const root = uploadRoot();
  const resolved = path.resolve(/* turbopackIgnore: true */ root, relativePath);
  if (!resolved.startsWith(root)) {
    throw new Error("Invalid file path");
  }

  return resolved;
}

export async function storeUpload(userId: string, file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > maxUploadBytes()) {
    throw new Error(`File exceeds ${Math.round(maxUploadBytes() / 1024 / 1024)} MB`);
  }

  const originalName = safeFileName(file.name || "upload");
  const relativePath = path.join(userId, `${randomUUID()}-${originalName}`);
  const absolutePath = resolveStoredPath(relativePath);
  await mkdir(/* turbopackIgnore: true */ path.dirname(absolutePath), { recursive: true });
  await writeFile(/* turbopackIgnore: true */ absolutePath, bytes);

  return {
    relativePath,
    sizeBytes: bytes.byteLength,
  };
}

export async function readStoredFile(file: AssetFile) {
  return readFile(/* turbopackIgnore: true */ resolveStoredPath(file.fileUrl));
}

export async function removeStoredFile(file: Pick<AssetFile, "fileUrl">) {
  await rm(/* turbopackIgnore: true */ resolveStoredPath(file.fileUrl), { force: true });
}
