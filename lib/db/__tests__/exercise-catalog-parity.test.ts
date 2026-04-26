/** @jest-environment node */
import { SEEDED_EXERCISES } from '../seed-workouts';
import { EXERCISE_CATALOG } from '../../../backend/src/lib/exercise-catalog';

describe('iOS seed ↔ backend catalog parity', () => {
  it('contains the same set of exercise ids', () => {
    const seedIds = new Set(SEEDED_EXERCISES.map((e) => e.id));
    const beIds = new Set(EXERCISE_CATALOG.map((e) => e.id));
    expect(beIds).toEqual(seedIds);
  });

  it('agrees on name, group, and muscle for every id', () => {
    const beById = new Map(EXERCISE_CATALOG.map((e) => [e.id, e] as const));
    for (const seed of SEEDED_EXERCISES) {
      const be = beById.get(seed.id);
      expect(be).toBeDefined();
      if (!be) continue;
      expect(be.name).toBe(seed.name);
      expect(be.group).toBe(seed.group);
      expect(be.muscle).toBe(seed.muscle);
    }
  });

  it('counts match (21 exercises both sides)', () => {
    expect(SEEDED_EXERCISES.length).toBe(21);
    expect(EXERCISE_CATALOG.length).toBe(21);
  });
});
