import { z } from "zod";
import type { ParseRequest, ParseResponse } from "@api-types";

export const ParseRequestSchema: z.ZodType<ParseRequest> = z.object({
  text: z.string().min(1, "text is required"),
  hint: z.enum(["food", "workout", "spend"]).optional(),
});

const FoodEntry = z.object({
  items: z.array(z.object({ name: z.string(), qty: z.string().optional() })),
  calories: z.number().optional(),
  meal: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
});
const WorkoutEntry = z.object({
  routine: z.string().optional(),
  sets: z.array(z.object({ exercise: z.string(), reps: z.number().int(), weight: z.number().optional() })).optional(),
  durationMin: z.number().optional(),
});
const SpendEntry = z.object({
  amount: z.number(),
  currency: z.string().length(3),
  category: z.string().optional(),
  merchant: z.string().optional(),
});

const Confidence = z.enum(["high", "low"]);

export const ParseResponseSchema: z.ZodType<ParseResponse> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("food"), data: FoodEntry, confidence: Confidence, raw: z.string() }),
  z.object({ kind: z.literal("workout"), data: WorkoutEntry, confidence: Confidence, raw: z.string() }),
  z.object({ kind: z.literal("spend"), data: SpendEntry, confidence: Confidence, raw: z.string() }),
]);
