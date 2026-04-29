import { describe, it, expect } from "vitest";
import { buildReviewMessages } from "../../src/lib/prompts/review.js";
import type { ReviewRequest } from "@api-types";

const baseAggs: ReviewRequest["aggregates"] = {
  spend: {
    totalMinor: 12500,
    currency: "USD",
    byCategory: { dining: 4500 },
    byDayOfWeek: [0, 0, 0, 0, 0, 12500, 0],
    topMerchant: { name: "Verve", totalMinor: 4000 },
  },
  rituals: { kept: 12, goalTotal: 21, perRitual: [], bestStreakRitual: null },
  workouts: { sessions: 3, prCount: 1 },
};

describe("buildReviewMessages", () => {
  it("weekly request asks for one-sentence hero and per-signal patterns", () => {
    const out = buildReviewMessages({
      period: "weekly",
      periodKey: "2026-W17",
      aggregates: baseAggs,
      signals: {
        topSpendDay: { dayOfWeek: 5, multiplier: 4.0 },
        ritualVsNonRitual: null,
        bestStreak: null,
        underBudget: null,
      },
    });
    expect(out.system).toMatch(/Reflective/);
    expect(out.user).toMatch(/weekly/i);
    expect(out.user).toMatch(/2026-W17/);
    expect(out.user).toMatch(/"topSpendDay"/);
    expect(out.user).not.toMatch(/"ritualVsNonRitual"/);
    expect(out.user).not.toMatch(/"bestStreak"/);
    expect(out.user).not.toMatch(/"underBudget"/);
    expect(out.user).toMatch(/one short sentence/i);
  });

  it("monthly request asks for a 2-3 sentence narrative", () => {
    const out = buildReviewMessages({
      period: "monthly",
      periodKey: "2026-04",
      aggregates: baseAggs,
      signals: {
        topSpendDay: null,
        ritualVsNonRitual: { sessionsOnRitualDays: 2, sessionsOnNonRitualDays: 1 },
        bestStreak: null,
        underBudget: null,
      },
    });
    expect(out.user).toMatch(/2-3 sentence/i);
    expect(out.user).toMatch(/2026-04/);
    expect(out.user).toMatch(/"ritualVsNonRitual"/);
  });

  it("includes only non-null signal keys in the user message", () => {
    const out = buildReviewMessages({
      period: "weekly",
      periodKey: "2026-W17",
      aggregates: baseAggs,
      signals: {
        topSpendDay: null,
        ritualVsNonRitual: null,
        bestStreak: null,
        underBudget: null,
      },
    });
    expect(out.user).toMatch(/no signals were detected/i);
  });
});
