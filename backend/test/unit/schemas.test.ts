import { describe, it, expect } from "vitest";
import { ChatRequestSchema } from "../../src/schemas/chat.js";
import { ParseRequestSchema, ParseResponseSchema } from "../../src/schemas/parse.js";
import { ReviewRequestSchema } from "../../src/schemas/review.js";

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

describe("ReviewRequestSchema", () => {
  it("accepts a well-formed month + aggregates", () => {
    const r = ReviewRequestSchema.parse({
      month: "2026-04",
      aggregates: {
        workouts: { sessions: 8 },
        food: { days: 28 },
        spend: { totalMinor: 100000, currency: "USD" },
        rituals: {},
      },
    });
    expect(r.month).toBe("2026-04");
  });
  it("rejects bad month format", () => {
    expect(() =>
      ReviewRequestSchema.parse({
        month: "April",
        aggregates: { workouts: { sessions: 0 }, food: { days: 0 }, spend: { totalMinor: 0, currency: "USD" }, rituals: {} },
      })
    ).toThrow();
  });
});
