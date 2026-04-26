import { z } from "zod";

export const GenerateRoutineRequestSchema = z.object({
  goal: z.string().min(3, "goal must be at least 3 characters").max(280, "goal must be at most 280 characters"),
});
export type GenerateRoutineRequest = z.infer<typeof GenerateRoutineRequestSchema>;

const StrengthSet = z.object({
  reps: z.number().int().min(1, "reps must be >= 1"),
  weight: z.number().min(0, "weight must be >= 0 (use 0 for bodyweight)"),
});

const StrengthExercise = z.object({
  id: z.string().min(1),
  sets: z.array(StrengthSet).min(3, "strength exercises need 3-4 sets").max(4, "strength exercises need 3-4 sets"),
});

const CardioSet = z
  .object({
    duration: z.number().positive().optional(),
    distance: z.number().positive().optional(),
    pace: z.string().optional(),
  })
  .refine((s) => s.duration !== undefined || s.distance !== undefined, {
    message: "cardio set requires duration or distance",
  });

const CardioExercise = z.object({
  id: z.string().min(1),
  sets: z.array(CardioSet).min(1),
});

const StrengthArm = z.object({
  tag: z.enum(["Upper", "Lower", "Full", "Custom"]),
  name: z.string().min(1),
  estMin: z.number().positive(),
  rationale: z.string().min(1),
  exercises: z.array(StrengthExercise).min(3, "strength routines need 3-6 exercises").max(6, "strength routines need 3-6 exercises"),
});

const CardioArm = z.object({
  tag: z.literal("Cardio"),
  name: z.string().min(1),
  estMin: z.number().positive(),
  rationale: z.string().min(1),
  exercises: z.array(CardioExercise).length(1, "cardio routines have exactly 1 exercise"),
});

export const GenerateRoutineResponseSchema = z.discriminatedUnion("tag", [
  StrengthArm,
  CardioArm,
]);
export type GenerateRoutineResponse = z.infer<typeof GenerateRoutineResponseSchema>;
