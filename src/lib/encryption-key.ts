export function decodeSecretKey(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("base64:")) return Buffer.from(trimmed.slice("base64:".length), "base64");
  if (trimmed.startsWith("hex:")) return Buffer.from(trimmed.slice("hex:".length), "hex");

  const base64 = Buffer.from(trimmed, "base64");
  if (base64.length === 32) return base64;

  const raw = Buffer.from(trimmed, "utf8");
  if (raw.length === 32) return raw;
  return Buffer.alloc(0);
}

export function isValidTokenEncryptionKey(value?: string) {
  return Boolean(value && decodeSecretKey(value).length === 32);
}
