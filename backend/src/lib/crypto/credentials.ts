import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_HEX_REGEX = /^[0-9a-fA-F]{64}$/;

function decodeKey(keyHex: string): Buffer {
  if (!KEY_HEX_REGEX.test(keyHex)) {
    throw new Error("encryption key must be 64 hex chars (32 bytes)");
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * AES-256-GCM. Output format: base64(12-byte IV ‖ ciphertext ‖ 16-byte authTag).
 * Per-encrypt random IV via crypto.randomBytes(12).
 */
export function encryptCredential(plaintext: string, keyHex: string): string {
  const key = decodeKey(keyHex);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString("base64");
}

/**
 * Inverse of encryptCredential. Throws if the auth tag fails verification
 * (wrong key, tampered ciphertext, or tampered tag).
 */
export function decryptCredential(ciphertextB64: string, keyHex: string): string {
  const key = decodeKey(keyHex);
  const buf = Buffer.from(ciphertextB64, "base64");
  if (buf.length < 12 + 16 + 1) {
    throw new Error("ciphertext too short");
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const ct = buf.subarray(12, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
