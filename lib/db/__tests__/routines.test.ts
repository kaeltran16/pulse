/** @jest-environment node */
import { listRoutines, getRoutineWithSets } from '../queries/routines';
import { sessions } from '../schema';
import { seedWorkouts } from '../seed-workouts';
import { makeTestDb } from './test-helpers';

describe('listRoutines', () => {
  it('returns the 6 seeded routines with derived exerciseCount and lastDoneAt=null', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const rows = await listRoutines(db);
    expect(rows).toHaveLength(6);
    const pushA = rows.find((r) => r.name === 'Push Day A')!;
    expect(pushA.tag).toBe('Upper');
    expect(pushA.exerciseCount).toBe(5);
    expect(pushA.lastDoneAt).toBeNull();
    expect(pushA.estMinutes).toBeGreaterThan(0);
  });

  it('orders routines by position', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const rows = await listRoutines(db);
    expect(rows.map((r) => r.name)).toEqual([
      'Push Day A',
      'Pull Day A',
      'Leg Day',
      'Upper Power',
      'Treadmill Intervals',
      'Steady Row 5k',
    ]);
  });

  it('reflects the most-recent session.finished_at as lastDoneAt', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const all = await listRoutines(db);
    const pushAId = all.find((r) => r.name === 'Push Day A')!.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).insert(sessions).values({
      routineId: pushAId,
      routineNameSnapshot: 'Push Day A',
      startedAt: 1000, finishedAt: 5000, durationSeconds: 4,
    }).run();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).insert(sessions).values({
      routineId: pushAId,
      routineNameSnapshot: 'Push Day A',
      startedAt: 6000, finishedAt: 9000, durationSeconds: 3,
    }).run();
    const after = await listRoutines(db);
    expect(after.find((r) => r.id === pushAId)!.lastDoneAt).toBe(9000);
  });
});

describe('getRoutineWithSets', () => {
  it('returns null for a missing id', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    expect(await getRoutineWithSets(db, 9999)).toBeNull();
  });

  it('returns the routine, ordered exercises, and ordered sets', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const all = await listRoutines(db);
    const pushAId = all.find((r) => r.name === 'Push Day A')!.id;
    const r = await getRoutineWithSets(db, pushAId);
    expect(r).not.toBeNull();
    expect(r!.name).toBe('Push Day A');
    expect(r!.exercises).toHaveLength(5);
    expect(r!.exercises[0].exercise.id).toBe('bench');
    expect(r!.exercises[0].sets).toHaveLength(4);
    expect(r!.exercises[0].sets[0].targetReps).toBe(5);
    expect(r!.exercises[0].sets[0].targetWeightKg).toBe(80);
    expect(r!.exercises[r!.exercises.length - 1].exercise.id).toBe('tricep-rope');
  });
});
