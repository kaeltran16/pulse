import type { Msg } from "../openrouter.js";
import { EXERCISE_CATALOG } from "../exercise-catalog.js";

const SYSTEM = `You are a strength coach building a workout routine for the user. You must pick exercises ONLY from the catalog the user lists. Output rules:

- Return JSON only. No prose. No code fences. No leading/trailing whitespace outside the JSON object.
- Top-level fields: name (3-5 word routine name), tag, estMin (integer minutes), rationale (one sentence), exercises (array).
- tag is one of "Upper", "Lower", "Full", "Custom" for strength routines, or "Cardio" for cardio routines.
- For strength routines (tag != "Cardio"): 3-6 exercises, each with 3-4 sets. Each set has reps (positive integer) and weight (kg, >= 0; use 0 for bodyweight). Use realistic intermediate-lifter weights in kilograms.
- For cardio routines (tag == "Cardio"): exactly 1 exercise with 1+ sets. Each set has duration (positive minutes) or distance (positive kilometers) or both, and an optional pace string (e.g. "5:30").
- Use only exercise ids from the catalog provided in the user message. Do not invent ids.`;

function escapeForUserBlock(s: string): string {
  // The user message wraps the goal in """ ... """. Strip embedded triples so
  // the model can't get confused about block boundaries on adversarial input.
  return s.replace(/"""/g, '\\"\\"\\"');
}

export function buildGenerateRoutineMessages(goal: string): Msg[] {
  const catalog = EXERCISE_CATALOG.map((e) => `- ${e.id}: ${e.name} (${e.group}/${e.muscle})`).join("\n");
  const safeGoal = escapeForUserBlock(goal);
  const user = `Goal:
"""
${safeGoal}
"""

Catalog (use these EXACT ids):
${catalog}

Return JSON matching the schema described above.`;
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ];
}
