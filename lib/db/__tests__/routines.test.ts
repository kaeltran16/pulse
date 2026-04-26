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

describe('duplicateRoutine', () => {
  it('clones routine + exercises + sets with new ids', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const all = await listRoutines(db);
    const source = all.find((r) => r.name === 'Push Day A')!;
    const newId = await duplicateRoutine(db, source.id);
    expect(newId).not.toBe(source.id);
    const src = await getRoutineWithSets(db, source.id);
    const dup = await getRoutineWithSets(db, newId);
    expect(dup!.exercises).toHaveLength(src!.exercises.length);
    for (let i = 0; i < dup!.exercises.length; i++) {
      expect(dup!.exercises[i].sets).toHaveLength(src!.exercises[i].sets.length);
      expect(dup!.exercises[i].id).not.toBe(src!.exercises[i].id);
    }
  });

  it('names "X" -> "X copy" -> "X copy 2" -> "X copy 3"', async () => {
    const { db } = makeTestDb();
    const id1 = await createEmptyRoutine(db, { name: 'Foo', tag: 'Custom' });
    const id2 = await duplicateRoutine(db, id1);
    const id3 = await duplicateRoutine(db, id2);
    const id4 = await duplicateRoutine(db, id3);
    const names = (await listRoutines(db)).map((r) => r.name).sort();
    expect(names).toEqual(['Foo', 'Foo copy', 'Foo copy 2', 'Foo copy 3']);
    void id4;
  });

  it('source is unchanged after duplicate', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const before = await getRoutineWithSets(db, (await listRoutines(db))[0].id);
    await duplicateRoutine(db, before!.id);
    const after = await getRoutineWithSets(db, before!.id);
    expect(after).toEqual(before);
  });
});

function draftFromFull(r: NonNullable<Awaited<ReturnType<typeof getRoutineWithSets>>>): DraftInput {
  return {
    routineId: r.id,
    name: r.name,
    tag: r.tag,
    color: r.color,
    position: r.position,
    restDefaultSeconds: r.restDefaultSeconds,
    warmupReminder: r.warmupReminder,
    autoProgress: r.autoProgress,
    exercises: r.exercises.map((ex) => ({
      id: ex.id,
      exerciseId: ex.exercise.id,
      restSeconds: ex.restSeconds,
      sets: ex.sets.map((s) => ({
        id: s.id,
        targetReps: s.targetReps,
        targetWeightKg: s.targetWeightKg,
        targetDurationSeconds: s.targetDurationSeconds,
        targetDistanceKm: s.targetDistanceKm,
      })),
    })),
  };
}

describe('updateRoutine', () => {
  it('updates name + session settings on the routine', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const id = (await listRoutines(db))[0].id;
    const r = (await getRoutineWithSets(db, id))!;
    const draft = draftFromFull(r);
    draft.name = 'Renamed';
    draft.restDefaultSeconds = 90;
    draft.warmupReminder = true;
    draft.autoProgress = true;
    await updateRoutine(db, draft);
    const after = (await getRoutineWithSets(db, id))!;
    expect(after.name).toBe('Renamed');
    expect(after.restDefaultSeconds).toBe(90);
    expect(after.warmupReminder).toBe(true);
    expect(after.autoProgress).toBe(true);
  });

  it('removes deleted exercises and their sets', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const id = (await listRoutines(db))[0].id;
    const r = (await getRoutineWithSets(db, id))!;
    const draft = draftFromFull(r);
    draft.exercises = draft.exercises.slice(0, 1);
    await updateRoutine(db, draft);
    const after = (await getRoutineWithSets(db, id))!;
    expect(after.exercises).toHaveLength(1);
  });

  it('inserts a new exercise (id=null) with its sets', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const id = (await listRoutines(db))[0].id;
    const r = (await getRoutineWithSets(db, id))!;
    const draft = draftFromFull(r);
    draft.exercises.push({
      id: null,
      exerciseId: 'lateral-raise',
      restSeconds: null,
      sets: [
        { id: null, targetReps: 12, targetWeightKg: 8, targetDurationSeconds: null, targetDistanceKm: null },
        { id: null, targetReps: 12, targetWeightKg: 8, targetDurationSeconds: null, targetDistanceKm: null },
      ],
    });
    await updateRoutine(db, draft);
    const after = (await getRoutineWithSets(db, id))!;
    expect(after.exercises).toHaveLength(r.exercises.length + 1);
    const last = after.exercises[after.exercises.length - 1];
    expect(last.exercise.id).toBe('lateral-raise');
    expect(last.sets).toHaveLength(2);
    expect(last.sets[0].targetReps).toBe(12);
  });

  it('updates a mutated set (targetReps, weight)', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const id = (await listRoutines(db))[0].id;
    const r = (await getRoutineWithSets(db, id))!;
    const draft = draftFromFull(r);
    draft.exercises[0].sets[0].targetReps = 999;
    draft.exercises[0].sets[0].targetWeightKg = 77.5;
    await updateRoutine(db, draft);
    const after = (await getRoutineWithSets(db, id))!;
    expect(after.exercises[0].sets[0].targetReps).toBe(999);
    expect(after.exercises[0].sets[0].targetWeightKg).toBe(77.5);
  });

  it('renumbers positions densely after delete', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const id = (await listRoutines(db))[0].id;
    const r = (await getRoutineWithSets(db, id))!;
    const draft = draftFromFull(r);
    draft.exercises = [draft.exercises[0], draft.exercises[2]];
    await updateRoutine(db, draft);
    const after = (await getRoutineWithSets(db, id))!;
    expect(after.exercises.map((e) => e.position)).toEqual([0, 1]);
  });

  it('updates per-exercise restSeconds (incl. setting to null)', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const id = (await listRoutines(db))[0].id;
    const r = (await getRoutineWithSets(db, id))!;
    const draft = draftFromFull(r);
    draft.exercises[0].restSeconds = 45;
    draft.exercises[1].restSeconds = null;
    await updateRoutine(db, draft);
    const after = (await getRoutineWithSets(db, id))!;
    expect(after.exercises[0].restSeconds).toBe(45);
    expect(after.exercises[1].restSeconds).toBeNull();
  });
});

import { startDraftSession } from '../queries/sessions';
import { insertCompletedSessionForTests } from './test-helpers';

describe('listRoutines.lastDoneAt', () => {
  it('uses the latest completed session, ignoring drafts even if they have a finishedAt', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSessionForTests(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A',
      startedAt: 1_000_000, finishedAt: 1_100_000,
      sets: [{ exerciseId: 'bench', exercisePosition: 0, setPosition: 0, reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null }],
    });
    // Manually corrupt: a draft with a non-null finished_at — defensive against
    // future code paths; the query layer never produces this state today.
    raw.prepare(`INSERT INTO sessions (routine_id, routine_name_snapshot, status, started_at, finished_at)
                 VALUES (1, 'Push Day A', 'draft', 9000000, 9100000)`).run();

    const rows = await listRoutines(db);
    const pushDayA = rows.find((r) => r.id === 1)!;
    expect(pushDayA.lastDoneAt).toBe(1_100_000);
  });
});

