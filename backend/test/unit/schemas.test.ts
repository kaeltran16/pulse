import { describe, it, expect } from "vitest";
import { ChatRequestSchema } from "../../src/schemas/chat.js";
import { ParseRequestSchema, ParseResponseSchema } from "../../src/schemas/parse.js";

describe("ChatRequestSchema", () => {
  it("accepts a minimal request", () => {
    const r = ChatRequestSchema.parse({ messages: [{ role: "user", content: "hi" }] });
    expect(r.messages).toHaveLength(1);
  });
  it("rejects empty messages", () => {
    expect(() => ChatRequestSchema.parse({ messages: [] })).toThrow();
  });
  it("rejects unknown role", () => {
    expect(() => ChatRequestSchema.parse({ messages: [{ role: "system", content: "x" }] })).toThrow();
  });
});

describe("ParseRequestSchema", () => {
  it("accepts text only", () => {
    expect(ParseRequestSchema.parse({ text: "ate eggs" }).text).toBe("ate eggs");
  });
  it("accepts a hint", () => {
    expect(ParseRequestSchema.parse({ text: "x", hint: "spend" }).hint).toBe("spend");
  });
  it("rejects empty text", () => {
    expect(() => ParseRequestSchema.parse({ text: "" })).toThrow();
  });
  it("rejects bad hint", () => {
    expect(() => ParseRequestSchema.parse({ text: "x", hint: "bogus" })).toThrow();
  });
});

describe("ParseResponseSchema", () => {
  it("accepts a spend entry", () => {
    const r = ParseResponseSchema.safeParse({
      kind: "spend",
      data: { amount: 5.75, currency: "USD", merchant: "Verve" },
      confidence: "high",
      raw: "verve $5.75",
    });
    expect(r.success).toBe(true);
  });

  it("accepts a workout entry", () => {
    const r = ParseResponseSchema.safeParse({
      kind: "workout",
      data: { durationMin: 30, routine: "run" },
      confidence: "low",
      raw: "ran 30 min",
    });
    expect(r.success).toBe(true);
  });

  it("accepts a chat response", () => {
    const r = ParseResponseSchema.safeParse({
      kind: "chat",
      confidence: "high",
      raw: "how was my week?",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a food entry (food was dropped)", () => {
    const r = ParseResponseSchema.safeParse({
      kind: "food",
      data: { items: [{ name: "eggs" }] },
      confidence: "high",
      raw: "ate eggs",
    });
    expect(r.success).toBe(false);
  });
});

