// app/lib/ai/keys.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { config } from "@/lib/config";

const ALGORITHM = "aes-256-gcm";
// Salt is non-secret but must be stable. Changing it invalidates all stored keys.
const SALT = "koinar-api-keys-v1";

function deriveKey(): Buffer {
  return scryptSync(config.session.secret, SALT, 32);
}

export function encryptApiKey(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all hex, colon-separated)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptApiKey(encryptedStr: string): string {
  const parts = encryptedStr.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted key format");
  const [ivHex, authTagHex, ciphertext] = parts;

  const key = deriveKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/** Decrypts a stored BYOK key for use at generation time. Never cache or log the result. */
export function getUserApiKey(encryptedKey: string): string {
  return decryptApiKey(encryptedKey);
}
