import { simpleParser } from "mailparser";

/**
 * Extracts plaintext from an RFC822 message buffer.
 * Returns parsed.text if present (mailparser fills this for text/plain parts
 * AND auto-converts text/html-only messages via its built-in html-to-text).
 * Returns '' when no extractable text exists.
 */
export async function extractPlaintext(rfc822: Buffer): Promise<string> {
  const parsed = await simpleParser(rfc822);
  return (parsed.text ?? "").trim();
}
