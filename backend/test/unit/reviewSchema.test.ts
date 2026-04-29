import { describe, it, expect } from "vitest";
import { ReviewRequestSchema, ReviewResponseSchema } from "../../src/schemas/review.js";

const validAggs = {
  spend: {
    totalMinor: 12500,
    currency: "USD",
    byCategory: { dining: 4500, groceries: 8000 },
    byDayOfWeek: [1000, 0, 0, 2500, 0, 8000, 1000],
    topMerchant: { name: "Trader Joe's", totalMinor: 8000 },
  },
  rituals: {
    kept: 12,
    goalTotal: 21,
    perRitual: [{ id: 1, name: "meditate", color: "rituals", kept: 5, streak: 5 }],
    bestStreakRitual: { name: "meditate", streak: 5, color: "rituals" },
  },
  workouts: { sessions: 3, prCount: 1 },
};
const validSignals = {
  topSpendDay: { dayOfWeek: 5, multiplier: 4.0 },
  ritualVsNonRitual: null,
  bestStreak: { ritualName: "meditate", streak: 5, color: "rituals" },
  underBudget: null,
};

describe("ReviewRequestSchema", () => {
  it("accepts a weekly request", () => {
    const ok = ReviewRequestSchema.safeParse({
      period: "weekly",
      periodKey: "2026-W17",
      aggregates: validAggs,
      signals: validSignals,
    });
    expect(ok.success).toBe(true);
  });

  it("accepts a monthly request", () => {
    const ok = ReviewRequestSchema.safeParse({
      period: "monthly",
      periodKey: "2026-04",
      aggregates: validAggs,
      signals: validSignals,
    });
    expect(ok.success).toBe(true);
  });

  it("rejects weekly with monthly-shaped key", () => {
    const r = ReviewRequestSchema.safeParse({
      period: "weekly",
      periodKey: "2026-04",
      aggregates: validAggs,
      signals: validSignals,
    });
    expect(r.success).toBe(false);
  });

  it("rejects monthly with weekly-shaped key", () => {
    const r = ReviewRequestSchema.safeParse({
      period: "monthly",
      periodKey: "2026-W17",
      aggregates: validAggs,
      signals: validSignals,
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative totalMinor", () => {
    const bad = { ...validAggs, spend: { ...validAggs.spend, totalMinor: -1 } };
    const r = ReviewRequestSchema.safeParse({
      period: "monthly",
      periodKey: "2026-04",
      aggregates: bad,
      signals: validSignals,
    });
    expect(r.success).toBe(false);
  });

  it("rejects byDayOfWeek length != 7", () => {
    const bad = { ...validAggs, spend: { ...validAggs.spend, byDayOfWeek: [0, 0, 0] } };
    const r = ReviewRequestSchema.safeParse({
      period: "monthly",
      periodKey: "2026-04",
      aggregates: bad,
      signals: validSignals,
    });
    expect(r.success).toBe(false);
  });
});

describe("ReviewResponseSchema", () => {
  it("accepts a valid response", () => {
    const ok = ReviewResponseSchema.safeParse({
      period: "weekly",
      hero: "A steady week.",
      patterns: [{ signal: "topSpendDay", text: "Friday cost 4× any other day." }],
      oneThingToTry: null,
      generatedAt: "2026-04-30T00:00:00Z",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects duplicate signal keys in patterns", () => {
    const r = ReviewResponseSchema.safeParse({
      period: "weekly",
      hero: "x",
      patterns: [
        { signal: "topSpendDay", text: "a" },
        { signal: "topSpendDay", text: "b" },
      ],
      oneThingToTry: null,
      generatedAt: "2026-04-30T00:00:00Z",
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty hero", () => {
    const r = ReviewResponseSchema.safeParse({
      period: "weekly",
      hero: "",
      patterns: [],
      oneThingToTry: null,
      generatedAt: "2026-04-30T00:00:00Z",
    });
    expect(r.success).toBe(false);
  });

  it("rejects > 3 patterns", () => {
    const r = ReviewResponseSchema.safeParse({
      period: "weekly",
      hero: "x",
      patterns: [
        { signal: "topSpendDay", text: "a" },
        { signal: "ritualVsNonRitual", text: "b" },
        { signal: "bestStreak", text: "c" },
        { signal: "underBudget", text: "d" },
      ],
      oneThingToTry: null,
      generatedAt: "2026-04-30T00:00:00Z",
    });
    expect(r.success).toBe(false);
  });
});
