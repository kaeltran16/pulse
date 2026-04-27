import { describe, it, expect } from "vitest";
import { extractPlaintext } from "../../src/lib/email/extract.js";

function rawEmail(parts: { headers: string; body: string }): Buffer {
  return Buffer.from(parts.headers + "\r\n\r\n" + parts.body, "utf8");
}

describe("extractPlaintext", () => {
  it("returns text/plain body when message is text/plain", async () => {
    const raw = rawEmail({
      headers:
        "From: bank@example.com\r\n" +
        "To: me@example.com\r\n" +
        "Subject: Charge alert\r\n" +
        "Content-Type: text/plain; charset=utf-8\r\n",
      body: "You spent $5.75 at Verve Coffee.",
    });
    const text = await extractPlaintext(raw);
    expect(text).toContain("You spent $5.75 at Verve Coffee.");
  });

  it("returns html-converted-to-text when message is text/html only", async () => {
    const raw = rawEmail({
      headers:
        "From: bank@example.com\r\n" +
        "Subject: Charge alert\r\n" +
        "Content-Type: text/html; charset=utf-8\r\n",
      body: "<p>You spent <b>$5.75</b> at Verve Coffee.</p>",
    });
    const text = await extractPlaintext(raw);
    expect(text).toContain("$5.75");
    expect(text).toContain("Verve Coffee");
    // tags should be stripped
    expect(text).not.toMatch(/<\w+>/);
  });

  it("returns empty string when message has no body content", async () => {
    const raw = rawEmail({
      headers: "From: x@y.z\r\nSubject: empty\r\nContent-Type: text/plain\r\n",
      body: "",
    });
    const text = await extractPlaintext(raw);
    expect(text).toBe("");
  });

  it("decodes HTML entities in html-only messages", async () => {
    const raw = rawEmail({
      headers: "Subject: t\r\nContent-Type: text/html\r\n",
      body: "<p>AT&amp;T billed you $9.99</p>",
    });
    const text = await extractPlaintext(raw);
    expect(text).toContain("AT&T");
  });
});
