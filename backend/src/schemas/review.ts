import { z } from "zod";
import type { ReviewRequest, ReviewResponse } from "@api-types";

const SpendAggregate = z.object({
  totalMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  byCategory: z.record(z.string(), z.number().int().nonnegative()),
  byDayOfWeek: z.array(z.number().int().nonnegative()).length(7),
  topMerchant: z
    .object({ name: z.string().min(1), totalMinor: z.number().int().nonnegative() })
    .nullable(),
});

const RitualsAggregate = z.object({
  kept: z.number().int().nonnegative(),
  goalTotal: z.number().int().nonnegative(),
  perRitual: z.array(
    z.object({
      id: z.number().int().positive(),
      name: z.string().min(1),
      color: z.string().min(1),
      kept: z.number().int().nonnegative(),
      streak: z.number().int().nonnegative(),
    }),
  ),
  bestStreakRitual: z
    .object({ name: z.string().min(1), streak: z.number().int().positive(), color: z.string().min(1) })
    .nullable(),
});

const WorkoutsAggregate = z.object({
  sessions: z.number().int().nonnegative(),
  prCount: z.number().int().nonnegative(),
});

const Aggregates = z.object({
  spend: SpendAggregate,
  rituals: RitualsAggregate,
  workouts: WorkoutsAggregate,
});

const Signals = z.object({
  topSpendDay: z
    .object({ dayOfWeek: z.number().int().min(0).max(6), multiplier: z.number().positive() })
    .nullable(),
  ritualVsNonRitual: z
    .object({
      sessionsOnRitualDays: z.number().int().nonnegative(),
      sessionsOnNonRitualDays: z.number().int().nonnegative(),
    })
    .nullable(),
  bestStreak: z
    .object({ ritualName: z.string().min(1), streak: z.number().int().positive(), color: z.string().min(1) })
    .nullable(),
  underBudget: z
    .object({ byMinor: z.number().int(), budgetMinor: z.number().int().positive() })
    .nullable(),
});

const Weekly = z.object({
  period: z.literal("weekly"),
  periodKey: z.string().regex(/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/, "weekly periodKey must be YYYY-Www"),
  aggregates: Aggregates,
  signals: Signals,
});

const Monthly = z.object({
  period: z.literal("monthly"),
  periodKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "monthly periodKey must be YYYY-MM"),
  aggregates: Aggregates,
  signals: Signals,
});

export const ReviewRequestSchema: z.ZodType<ReviewRequest> = z.discriminatedUnion("period", [Weekly, Monthly]);

const PatternProse = z.object({
  signal: z.enum(["topSpendDay", "ritualVsNonRitual", "bestStreak", "underBudget"]),
  text: z.string().min(1),
});

export const ReviewResponseSchema: z.ZodType<ReviewResponse> = z.object({
  period: z.enum(["weekly", "monthly"]),
  hero: z.string().min(1),
  patterns: z
    .array(PatternProse)
    .max(3)
    .refine((arr) => new Set(arr.map((p) => p.signal)).size === arr.length, {
      message: "patterns must have unique signal keys",
    }),
  oneThingToTry: z
    .object({ markdown: z.string().min(1), askPalPrompt: z.string().min(1) })
    .nullable(),
  generatedAt: z.string().min(1),
});

export const ReviewModelOutputSchema = z.object({
  hero: z.string().min(1),
  patterns: z
    .array(PatternProse)
    .max(3)
    .refine((arr) => new Set(arr.map((p) => p.signal)).size === arr.length, {
      message: "patterns must have unique signal keys",
    }),
  oneThingToTry: z
    .object({ markdown: z.string().min(1), askPalPrompt: z.string().min(1) })
    .nullable(),
});
