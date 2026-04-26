/** @jest-environment node */
import { saveGeneratedRoutine } from '../queries/saveGeneratedRoutine';
import { listRoutines, getRoutineWithSets } from '../queries/routines';
import { routines } from '../schema';
import { seedWorkouts } from '../seed-workouts';
import { makeTestDb } from './test-helpers';
import type { GeneratedRoutine } from '../../pal/types';
import { sql } from 'drizzle-orm';

const STRENGTH: GeneratedRoutine = {
  tag: 'Upper', name: 'Push Day', estMin: 45, rationale: 'why',
  exercises: [
    { id: 'bench', sets: [{ reps: 5, weight: 80 }, { reps: 5, weight: 80 }, { reps: 5, weight: 80 }] },
    { id: 'ohp',   sets: [{ reps: 8, weight: 40 }, { reps: 8, weight: 40 }, { reps: 8, weight: 40 }] },
    { id: 'tricep-rope', sets: [{ reps: 12, weight: 25 }, { reps: 12, weight: 25 }, { reps: 12, weight: 25 }] },
  ],
};

const CARDIO: GeneratedRoutine = {
  tag: 'Cardio', name: 'Easy Run', estMin: 20, rationale: 'zone 2',
  exercises: [{ id: 'treadmill', sets: [{ duration: 20 }] }],
};

describe('saveGeneratedRoutine', () => {
  it('inserts a strength routine with its exercises and sets, and returns the new id', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const before = (await listRoutines(db)).length;
    const id = await saveGeneratedRoutine(db, STRENGTH);
    expect(id).toBeGreaterThan(0);
    const after = await listRoutines(db);
    expect(after.length).toBe(before + 1);
    const row = await getRoutineWithSets(db, id);
    expect(row).not.toBeNull();
    expect(row!.name).toBe('Push Day');
    expect(row!.tag).toBe('Upper');
    expect(row!.exercises).toHaveLength(3);
    expect(row!.exercises[0].exercise.id).toBe('bench');
    expect(row!.exercises[0].sets).toHaveLength(3);
    expect(row!.exercises[0].sets[0].targetReps).toBe(5);
    expect(row!.exercises[0].sets[0].targetWeightKg).toBe(80);
  });

  it('inserts a cardio routine with a single exercise and a duration set', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const id = await saveGeneratedRoutine(db, CARDIO);
    const row = await getRoutineWithSets(db, id);
    expect(row).not.toBeNull();
    expect(row!.tag).toBe('Cardio');
    expect(row!.exercises).toHaveLength(1);
    expect(row!.exercises[0].exercise.id).toBe('treadmill');
    expect(row!.exercises[0].sets).toHaveLength(1);
    expect(row!.exercises[0].sets[0].targetDurationSeconds).toBe(20 * 60);
  });

  it('uses the routines.color default ("accent")', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const id = await saveGeneratedRoutine(db, STRENGTH);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (db as any).select().from(routines).where(sql`id = ${id}`).get();
    expect(row.color).toBe('accent');
  });

  it('appends to the routines list (position = max + 1)', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const beforeMax = (await listRoutines(db)).reduce((m, r) => Math.max(m, r.position), -1);
    const id = await saveGeneratedRoutine(db, STRENGTH);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (db as any).select().from(routines).where(sql`id = ${id}`).get();
    expect(row.position).toBe(beforeMax + 1);
  });

  it('rolls back on a mid-transaction failure (no half-saved routine)', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const before = (await listRoutines(db)).length;
    // GeneratedRoutine with an exercise id that doesn't exist in the seeded
    // catalog → the routine_exercises FK insert will fail.
    const bogus: GeneratedRoutine = {
      ...STRENGTH,
      exercises: [{ id: 'definitely-not-an-exercise', sets: STRENGTH.exercises[0].sets }, ...STRENGTH.exercises.slice(1)],
    };
    await expect(saveGeneratedRoutine(db, bogus)).rejects.toBeTruthy();
    const after = await listRoutines(db);
    expect(after.length).toBe(before);
  });
});
