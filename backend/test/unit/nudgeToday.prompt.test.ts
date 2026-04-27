import { describe, it, expect } from "vitest";
import { buildNudgeTodayPrompt } from "../../src/lib/prompts/nudgeToday.js";

describe("buildNudgeTodayPrompt", () => {
  it("includes done/total counts", () => {
    const result = buildNudgeTodayPrompt({
      date: "2026-04-28",
      done: 3,
      total: 5,
      remaining: [{ title: "Stretch", streak: 4, cadence: "evening" }],
    });
    expect(result).toContain("3/5");
  });

  it("includes each remaining ritual title + streak", () => {
    const result = buildNudgeTodayPrompt({
      date: "2026-04-28",
      done: 0,
      total: 2,
      remaining: [
        { title: "Morning pages", streak: 12, cadence: "morning" },
        { title: "Stretch",       streak: 3,  cadence: "evening" },
      ],
    });
    expect(result).toContain("Morning pages");
    expect(result).toContain("12");
    expect(result).toContain("Stretch");
    expect(result).toContain("3");
  });

  it("includes bestStreak when provided", () => {
    const result = buildNudgeTodayPrompt({
      date: "2026-04-28",
      done: 1,
      total: 5,
      remaining: [],
      bestStreak: { title: "8 glasses water", streak: 23 },
    });
    expect(result).toContain("8 glasses water");
    expect(result).toContain("23");
  });

  it("handles bestStreak undefined without error", () => {
    expect(() => buildNudgeTodayPrompt({
      date: "2026-04-28", done: 0, total: 1, remaining: [],
    })).not.toThrow();
  });

  it("instructs ≤120 chars + JSON-only output", () => {
    const result = buildNudgeTodayPrompt({
      date: "2026-04-28", done: 0, total: 0, remaining: [],
    });
    expect(result).toContain("120");
    expect(result.toLowerCase()).toContain("json");
  });
});
