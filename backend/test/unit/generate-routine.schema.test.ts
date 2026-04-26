import { describe, it, expect } from "vitest";
import { GenerateRoutineRequestSchema, GenerateRoutineResponseSchema } from "../../src/schemas/generate-routine.js";

describe("GenerateRoutineRequestSchema", () => {
  it("accepts a 3-280 char goal", () => {
    expect(GenerateRoutineRequestSchema.safeParse({ goal: "push day" }).success).toBe(true);
  });

  it("rejects an empty goal", () => {
    expect(GenerateRoutineRequestSchema.safeParse({ goal: "" }).success).toBe(false);
  });

  it("rejects a goal under 3 chars", () => {
    expect(GenerateRoutineRequestSchema.safeParse({ goal: "ab" }).success).toBe(false);
  });

  it("rejects a goal over 280 chars", () => {
    expect(GenerateRoutineRequestSchema.safeParse({ goal: "x".repeat(281) }).success).toBe(false);
  });

  it("rejects missing goal field", () => {
    expect(GenerateRoutineRequestSchema.safeParse({}).success).toBe(false);
  });
});

const STRENGTH_OK = {
  tag: "Upper",
  name: "Push Day",
  estMin: 45,
  rationale: "Compound first, then accessories.",
  exercises: [
    { id: "bench", sets: [{ reps: 5, weight: 80 }, { reps: 5, weight: 80 }, { reps: 5, weight: 80 }] },
    { id: "ohp",   sets: [{ reps: 8, weight: 40 }, { reps: 8, weight: 40 }, { reps: 8, weight: 40 }] },
    { id: "tricep-rope", sets: [{ reps: 12, weight: 25 }, { reps: 12, weight: 25 }, { reps: 12, weight: 25 }] },
  ],
};

const CARDIO_OK = {
  tag: "Cardio",
  name: "Easy Run",
  estMin: 20,
  rationale: "Zone 2 base.",
  exercises: [
    { id: "treadmill", sets: [{ duration: 20 }] },
  ],
};

describe("GenerateRoutineResponseSchema", () => {
  it("accepts a strength happy path", () => {
    expect(GenerateRoutineResponseSchema.safeParse(STRENGTH_OK).success).toBe(true);
  });

  it("accepts a cardio happy path with duration", () => {
    expect(GenerateRoutineResponseSchema.safeParse(CARDIO_OK).success).toBe(true);
  });

  it("accepts a cardio happy path with distance + pace", () => {
    const ok = { ...CARDIO_OK, exercises: [{ id: "treadmill", sets: [{ distance: 5, pace: "5:30" }] }] };
    expect(GenerateRoutineResponseSchema.safeParse(ok).success).toBe(true);
  });

  it("rejects strength with 2 exercises (under min of 3)", () => {
    const bad = { ...STRENGTH_OK, exercises: STRENGTH_OK.exercises.slice(0, 2) };
    expect(GenerateRoutineResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects strength with 7 exercises (over max of 6)", () => {
    const bad = { ...STRENGTH_OK, exercises: Array(7).fill(STRENGTH_OK.exercises[0]) };
    expect(GenerateRoutineResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects strength with 2 sets on an exercise (under min of 3)", () => {
    const bad = { ...STRENGTH_OK, exercises: [{ ...STRENGTH_OK.exercises[0], sets: STRENGTH_OK.exercises[0].sets.slice(0, 2) }, ...STRENGTH_OK.exercises.slice(1)] };
    expect(GenerateRoutineResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects strength set with negative weight", () => {
    const bad = { ...STRENGTH_OK, exercises: [{ id: "bench", sets: [{ reps: 5, weight: -1 }, { reps: 5, weight: 80 }, { reps: 5, weight: 80 }] }, ...STRENGTH_OK.exercises.slice(1)] };
    expect(GenerateRoutineResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects strength set with reps of 0", () => {
    const bad = { ...STRENGTH_OK, exercises: [{ id: "bench", sets: [{ reps: 0, weight: 80 }, { reps: 5, weight: 80 }, { reps: 5, weight: 80 }] }, ...STRENGTH_OK.exercises.slice(1)] };
    expect(GenerateRoutineResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects cardio with 2 exercises", () => {
    const bad = { ...CARDIO_OK, exercises: [CARDIO_OK.exercises[0], CARDIO_OK.exercises[0]] };
    expect(GenerateRoutineResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects cardio set with neither duration nor distance", () => {
    const bad = { ...CARDIO_OK, exercises: [{ id: "treadmill", sets: [{ pace: "5:30" }] }] };
    expect(GenerateRoutineResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects cardio set with non-positive duration", () => {
    const bad = { ...CARDIO_OK, exercises: [{ id: "treadmill", sets: [{ duration: 0 }] }] };
    expect(GenerateRoutineResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects unknown tag", () => {
    const bad = { ...STRENGTH_OK, tag: "Mystery" };
    expect(GenerateRoutineResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects strength sets shape on a Cardio tag", () => {
    const bad = { ...CARDIO_OK, exercises: [{ id: "treadmill", sets: [{ reps: 10, weight: 0 }] }] };
    expect(GenerateRoutineResponseSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects missing rationale", () => {
    const { rationale: _r, ...bad } = STRENGTH_OK;
    expect(GenerateRoutineResponseSchema.safeParse(bad).success).toBe(false);
  });
});
