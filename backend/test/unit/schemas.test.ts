import { describe, it, expect } from "vitest";
import { ChatRequestSchema } from "../../src/schemas/chat.js";
import { ParseRequestSchema } from "../../src/schemas/parse.js";
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
    expect(ParseRequestSchema.parse({ text: "x", hint: "food" }).hint).toBe("food");
  });
  it("rejects empty text", () => {
    expect(() => ParseRequestSchema.parse({ text: "" })).toThrow();
  });
  it("rejects bad hint", () => {
    expect(() => ParseRequestSchema.parse({ text: "x", hint: "bogus" })).toThrow();
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
