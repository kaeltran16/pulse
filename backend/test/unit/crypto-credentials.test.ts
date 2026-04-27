import { describe, it, expect } from "vitest";
import { encryptCredential, decryptCredential } from "../../src/lib/crypto/credentials.js";

const KEY_HEX = "a".repeat(64); // 32 bytes hex
const OTHER_KEY_HEX = "b".repeat(64);

describe("encryptCredential / decryptCredential", () => {
  it("round-trips a string", () => {
    const ct = encryptCredential("hunter2", KEY_HEX);
    expect(decryptCredential(ct, KEY_HEX)).toBe("hunter2");
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const ct1 = encryptCredential("same", KEY_HEX);
    const ct2 = encryptCredential("same", KEY_HEX);
    expect(ct1).not.toBe(ct2);
  });

  it("decryption with the wrong key throws", () => {
    const ct = encryptCredential("secret", KEY_HEX);
    expect(() => decryptCredential(ct, OTHER_KEY_HEX)).toThrow();
  });

  it("decryption fails closed on tampered ciphertext", () => {
    const ct = encryptCredential("secret", KEY_HEX);
    const buf = Buffer.from(ct, "base64");
    // Flip a byte in the middle (ciphertext region, between IV and tag)
    buf[15] ^= 0x01;
    const tampered = buf.toString("base64");
    expect(() => decryptCredential(tampered, KEY_HEX)).toThrow();
  });

  it("rejects malformed key (not 64 hex chars)", () => {
    expect(() => encryptCredential("x", "abc")).toThrow();
  });

  it("generates 10k unique IVs across 10k encrypts", () => {
    const ivs = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const ct = encryptCredential("x", KEY_HEX);
      const iv = Buffer.from(ct, "base64").subarray(0, 12).toString("hex");
      ivs.add(iv);
    }
    expect(ivs.size).toBe(10_000);
  });
});
