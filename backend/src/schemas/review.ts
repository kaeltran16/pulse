import { z } from "zod";
import type { ReviewRequest, ReviewResponse } from "@api-types";

const WorkoutAggregate = z.object({ sessions: z.number().int().nonnegative(), totalVolume: z.number().optional() });
const FoodAggregate = z.object({ avgCalories: z.number().optional(), days: z.number().int().nonnegative() });
const SpendAggregate = z.object({
  totalMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  byCategory: z.record(z.string(), z.number()).optional(),
});
const RitualAggregate = z.object({ streaks: z.record(z.string(), z.number()).optional() });

export const ReviewRequestSchema: z.ZodType<ReviewRequest> = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM"),
  aggregates: z.object({
    workouts: WorkoutAggregate,
    food: FoodAggregate,
    spend: SpendAggregate,
    rituals: RitualAggregate,
  }),
});

export const ReviewResponseSchema: z.ZodType<ReviewResponse> = z.object({
  markdown: z.string().min(1),
  generatedAt: z.string(),
});
