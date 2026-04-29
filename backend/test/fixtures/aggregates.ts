import type { ReviewRequest } from "@api-types";

export const sampleAggregates: ReviewRequest["aggregates"] = {
  spend: {
    totalMinor: 125000,
    currency: "USD",
    byCategory: { dining: 30000, groceries: 45000, other: 50000 },
    byDayOfWeek: [10000, 5000, 5000, 5000, 60000, 30000, 10000],
    topMerchant: { name: "Trader Joe's", totalMinor: 30000 },
  },
  rituals: {
    kept: 21,
    goalTotal: 28,
    perRitual: [{ id: 1, name: "meditate", color: "rituals", kept: 7, streak: 7 }],
    bestStreakRitual: { name: "meditate", streak: 7, color: "rituals" },
  },
  workouts: { sessions: 3, prCount: 1 },
};

export const sampleSignals: ReviewRequest["signals"] = {
  topSpendDay: { dayOfWeek: 4, multiplier: 4.0 },
  ritualVsNonRitual: { sessionsOnRitualDays: 2, sessionsOnNonRitualDays: 1 },
  bestStreak: { ritualName: "meditate", streak: 7, color: "rituals" },
  underBudget: null,
};
