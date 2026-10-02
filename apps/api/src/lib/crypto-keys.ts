import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../env.js";

/**
 * Derives a consistent 32-byte key from the configured encryption secret using SHA-256.
 */
function getDerivedKey(): Buffer {
  const secret = env.aiKeyEncryptionSecret;
  return createHash("sha256").update(secret).digest();
}

/**
 * Encrypts an API key using AES-256-GCM with a random 12-byte IV and 16-byte auth tag.
 * Returns formatted string: `${iv}:${authTag}:${ciphertext}`
 */
export function encryptApiKey(plainKey: string): string {
  const cleanKey = plainKey.trim();
  if (!cleanKey) {
    throw new Error("API Key cannot be empty");
  }

  const key = getDerivedKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(cleanKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a ciphertext formatted as `${iv}:${authTag}:${ciphertext}` using AES-256-GCM.
 */
export function decryptApiKey(encryptedPayload: string): string {
  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted key format");
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const key = getDerivedKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Masks an API key for safe public or dashboard display (e.g. "kie_4a9b••••••••12ef").
 */
export function maskApiKey(rawKey: string): string {
  const key = rawKey.trim();
  if (!key) return "••••••••";

  if (key.length <= 8) {
    return "••••••••";
  }

  const prefix = key.slice(0, 4);
  const suffix = key.slice(-4);
  const maskLength = Math.min(Math.max(key.length - 8, 8), 16);
  return `${prefix}${"•".repeat(maskLength)}${suffix}`;
}
