// Mirror of GenerateRoutineResponse from backend/src/schemas/generate-routine.ts.
// Kept TS-only (no runtime schema) — backend already validated; this just shapes
// the client consumer's view of the response.

export type StrengthSet = { reps: number; weight: number };
export type CardioSet = { duration?: number; distance?: number; pace?: string };

export type StrengthExercise = { id: string; sets: StrengthSet[] };
export type CardioExercise = { id: string; sets: CardioSet[] };

export type GeneratedRoutine =
  | { tag: 'Upper' | 'Lower' | 'Full' | 'Custom'; name: string; estMin: number; rationale: string; exercises: StrengthExercise[] }
  | { tag: 'Cardio';                                name: string; estMin: number; rationale: string; exercises: [CardioExercise] };
