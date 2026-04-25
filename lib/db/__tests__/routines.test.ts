/** @jest-environment node */
import { eq } from 'drizzle-orm';
import {
  listRoutines,
  getRoutineWithSets,
  createEmptyRoutine,
  deleteRoutine,
  duplicateRoutine,
  updateRoutine,
  type DraftInput,
} from '../queries/routines';
import { routines, routineExercises, sessions } from '../schema';
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

  it('exposes session settings on the hydrated routine', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const all = await listRoutines(db);
    const id = all[0].id;
    const r = await getRoutineWithSets(db, id);
    expect(r).not.toBeNull();
    expect(r!.restDefaultSeconds).toBe(120);
    expect(r!.warmupReminder).toBe(false);
    expect(r!.autoProgress).toBe(false);
  });
});

describe('createEmptyRoutine', () => {
  it('inserts a routine and returns its id', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const before = await listRoutines(db);
    const id = await createEmptyRoutine(db, { name: 'My routine', tag: 'Custom' });
    expect(typeof id).toBe('number');
    const after = await listRoutines(db);
    expect(after).toHaveLength(before.length + 1);
    const created = after.find((r) => r.id === id)!;
    expect(created.name).toBe('My routine');
    expect(created.tag).toBe('Custom');
    expect(created.exerciseCount).toBe(0);
  });

  it('appends to the end (max position + 1)', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const before = await listRoutines(db);
    const maxPos = Math.max(...before.map((r) => r.position));
    const id = await createEmptyRoutine(db, { name: 'Z', tag: 'Custom' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (db as any).select().from(routines).where(eq(routines.id, id));
    expect(row[0].position).toBe(maxPos + 1);
  });

  it('uses default session settings', async () => {
    const { db } = makeTestDb();
    const id = await createEmptyRoutine(db, { name: 'X', tag: 'Custom' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (db as any).select().from(routines).where(eq(routines.id, id));
    expect(row[0].restDefaultSeconds).toBe(120);
    expect(row[0].warmupReminder).toBe(false);
    expect(row[0].autoProgress).toBe(false);
  });
});

describe('deleteRoutine', () => {
  it('removes the routine and cascades exercises + sets', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const all = await listRoutines(db);
    const target = all[0].id;
    await deleteRoutine(db, target);
    const after = await listRoutines(db);
    expect(after.find((r) => r.id === target)).toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reLeft = await (db as any).select().from(routineExercises).where(eq(routineExercises.routineId, target));
    expect(reLeft).toHaveLength(0);
  });

  it('preserves past sessions with routine_id=NULL and snapshot intact', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const all = await listRoutines(db);
    const target = all[0].id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).insert(sessions).values({
      routineId: target,
      routineNameSnapshot: 'Push Day A',
      startedAt: 1_700_000_000_000,
      finishedAt: 1_700_000_900_000,
      durationSeconds: 900,
      totalVolumeKg: 1000,
      prCount: 0,
    }).run();
    await deleteRoutine(db, target);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const surviving = await (db as any).select().from(sessions);
    expect(surviving).toHaveLength(1);
    expect(surviving[0].routineId).toBeNull();
    expect(surviving[0].routineNameSnapshot).toBe('Push Day A');
  });
});
