import { describe, it, expect } from "vitest";
import { EXERCISE_CATALOG, EXERCISE_ID_SET } from "../../src/lib/exercise-catalog.js";

describe("EXERCISE_CATALOG", () => {
  it("contains the 21 seeded exercises", () => {
    expect(EXERCISE_CATALOG.length).toBe(21);
  });

  it("has unique ids", () => {
    const ids = EXERCISE_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes the four cardio ids", () => {
    const cardio = EXERCISE_CATALOG.filter((e) => e.group === "Cardio").map((e) => e.id);
    expect(cardio.sort()).toEqual(["bike", "rower", "stairmaster", "treadmill"]);
  });

  it("EXERCISE_ID_SET reflects the catalog", () => {
    expect(EXERCISE_ID_SET.size).toBe(21);
    expect(EXERCISE_ID_SET.has("bench")).toBe(true);
    expect(EXERCISE_ID_SET.has("does-not-exist")).toBe(false);
  });

  it("each entry has id/name/group/muscle as non-empty strings", () => {
    for (const e of EXERCISE_CATALOG) {
      expect(typeof e.id).toBe("string");
      expect(e.id.length).toBeGreaterThan(0);
      expect(typeof e.name).toBe("string");
      expect(e.name.length).toBeGreaterThan(0);
      expect(typeof e.group).toBe("string");
      expect(e.group.length).toBeGreaterThan(0);
      expect(typeof e.muscle).toBe("string");
      expect(e.muscle.length).toBeGreaterThan(0);
    }
  });
});
