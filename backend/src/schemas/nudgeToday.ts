import { z } from "zod";

const RitualCadence = z.enum(["morning", "evening", "all_day", "weekdays", "daily"]);

export const NudgeTodayRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  done: z.number().int().min(0),
  total: z.number().int().min(0),
  remaining: z.array(
    z.object({ title: z.string(), streak: z.number().int().min(0), cadence: RitualCadence }),
  ).max(50),
  bestStreak: z.object({
    title: z.string(),
    streak: z.number().int().min(0),
  }).optional(),
});

export const NudgeTodayResponseSchema = z.object({
  sub: z.string().min(1),
});

export type NudgeTodayRequestParsed = z.infer<typeof NudgeTodayRequestSchema>;
export type NudgeTodayResponseParsed = z.infer<typeof NudgeTodayResponseSchema>;
