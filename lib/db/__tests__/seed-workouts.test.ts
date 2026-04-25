/** @jest-environment node */
import { exercises, routines, routineExercises, routineSets } from '../schema';
import { seedWorkouts } from '../seed-workouts';
import { makeTestDb } from './test-helpers';

describe('seedWorkouts', () => {
  it('inserts 21 exercises on a fresh DB', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const rows = await db.select().from(exercises);
    expect(rows.length).toBe(21);
  });

  it('inserts 6 routines on a fresh DB', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const rows = await db.select().from(routines);
    expect(rows.length).toBe(6);
    expect(rows.map((r) => r.name)).toEqual([
      'Push Day A',
      'Pull Day A',
      'Leg Day',
      'Upper Power',
      'Treadmill Intervals',
      'Steady Row 5k',
    ]);
  });

  it('populates routine_exercises and routine_sets for every routine', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const re = await db.select().from(routineExercises);
    const rs = await db.select().from(routineSets);
    expect(re.length).toBe(21);
    // Set totals per routine: Push A 16, Pull A 15, Leg Day 16, Upper Power 12,
    // Treadmill 1, Row 1 → 61.
    expect(rs.length).toBe(61);
  });

  it('is idempotent for exercises (re-running the seeder does not duplicate them)', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    seedWorkouts(db);
    const rows = await db.select().from(exercises);
    expect(rows.length).toBe(21);
  });

  it('does not re-seed routines if any routine row already exists', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const before = (await db.select().from(routines)).length;
    seedWorkouts(db);
    const after = (await db.select().from(routines)).length;
    expect(after).toBe(before);
  });

  it('seeds the cardio routines with duration+distance and null reps/weight', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const treadmillRoutine = (await db.select().from(routines)).find((r) => r.name === 'Treadmill Intervals')!;
    const re = (await db.select().from(routineExercises))
      .filter((row) => row.routineId === treadmillRoutine.id);
    expect(re).toHaveLength(1);
    const rs = (await db.select().from(routineSets))
      .filter((row) => row.routineExerciseId === re[0].id);
    expect(rs).toHaveLength(1);
    expect(rs[0].targetDurationSeconds).toBe(1800);
    expect(rs[0].targetDistanceKm).toBe(5.0);
    expect(rs[0].targetReps).toBeNull();
    expect(rs[0].targetWeightKg).toBeNull();
  });
});
