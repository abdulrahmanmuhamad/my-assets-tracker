import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { decodeSecretKey } from "./encryption-key";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function encryptionKey() {
  const configured = process.env.TOKEN_ENCRYPTION_KEY;
  if (!configured) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required to encrypt brokerage provider tokens");
  }

  const key = decodeSecretKey(configured);
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }

  return key;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(encryptedValue: string) {
  const [version, iv, tag, encrypted] = encryptedValue.split(":");
  if (version !== VERSION || !iv || !tag || !encrypted) {
    throw new Error("Unsupported encrypted secret format");
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}
