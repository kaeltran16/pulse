import type { ReviewRequest } from "@api-types";

export const sampleAggregates: ReviewRequest["aggregates"] = {
  workouts: { sessions: 12, totalVolume: 38400 },
  food: { avgCalories: 2150, days: 28 },
  spend: { totalMinor: 125000, currency: "USD", byCategory: { groceries: 45000, dining: 30000, other: 50000 } },
  rituals: { streaks: { meditation: 21, journaling: 14 } },
};
