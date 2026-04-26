// Source of truth for the 21-exercise catalog used in /generate-routine prompts
// and validation. Mirrors lib/db/seed-workouts.ts SEEDED_EXERCISES; the iOS
// suite (lib/db/__tests__/exercise-catalog-parity.test.ts) enforces drift.

export type ExerciseGroup = "Push" | "Pull" | "Legs" | "Core" | "Cardio";

export interface CatalogExercise {
  id: string;
  name: string;
  group: ExerciseGroup;
  muscle: string;
}

export const EXERCISE_CATALOG: readonly CatalogExercise[] = [
  // Push
  { id: "bench",         name: "Barbell Bench Press", group: "Push",   muscle: "Chest" },
  { id: "ohp",           name: "Overhead Press",      group: "Push",   muscle: "Shoulders" },
  { id: "incline-db",    name: "Incline DB Press",    group: "Push",   muscle: "Chest" },
  { id: "tricep-rope",   name: "Tricep Pushdown",     group: "Push",   muscle: "Triceps" },
  { id: "lateral-raise", name: "Lateral Raise",       group: "Push",   muscle: "Shoulders" },
  // Pull
  { id: "deadlift",      name: "Deadlift",            group: "Pull",   muscle: "Back" },
  { id: "pullup",        name: "Pull-up",             group: "Pull",   muscle: "Back" },
  { id: "barbell-row",   name: "Barbell Row",         group: "Pull",   muscle: "Back" },
  { id: "face-pull",     name: "Face Pull",           group: "Pull",   muscle: "Rear Delts" },
  { id: "bicep-curl",    name: "Bicep Curl",          group: "Pull",   muscle: "Biceps" },
  // Legs
  { id: "squat",         name: "Back Squat",          group: "Legs",   muscle: "Quads" },
  { id: "rdl",           name: "Romanian Deadlift",   group: "Legs",   muscle: "Hamstrings" },
  { id: "leg-press",     name: "Leg Press",           group: "Legs",   muscle: "Quads" },
  { id: "calf-raise",    name: "Standing Calf Raise", group: "Legs",   muscle: "Calves" },
  { id: "walking-lunge", name: "Walking Lunge",       group: "Legs",   muscle: "Quads" },
  // Core
  { id: "plank",         name: "Plank",               group: "Core",   muscle: "Core" },
  { id: "hanging-leg",   name: "Hanging Leg Raise",   group: "Core",   muscle: "Abs" },
  // Cardio
  { id: "treadmill",     name: "Treadmill Run",       group: "Cardio", muscle: "Cardio" },
  { id: "rower",         name: "Row Erg",             group: "Cardio", muscle: "Cardio" },
  { id: "bike",          name: "Assault Bike",        group: "Cardio", muscle: "Cardio" },
  { id: "stairmaster",   name: "StairMaster",         group: "Cardio", muscle: "Cardio" },
];

export const EXERCISE_ID_SET: ReadonlySet<string> = new Set(EXERCISE_CATALOG.map((e) => e.id));
