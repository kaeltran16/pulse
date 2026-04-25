/** @jest-environment node */
import { getPRsForExercises } from '../queries/prs';
import { prs, sessions } from '../schema';
import { seedWorkouts } from '../seed-workouts';
import { makeTestDb } from './test-helpers';

describe('getPRsForExercises', () => {
  it('returns an empty Map when no PRs exist', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const m = await getPRsForExercises(db, ['bench', 'ohp']);
    expect(m.size).toBe(0);
  });

  it('returns weight/reps for the requested exercises only', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).insert(sessions).values({
      routineNameSnapshot: 'x', startedAt: 0, finishedAt: 1, durationSeconds: 1,
    }).run();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).insert(prs).values([
      { exerciseId: 'bench',    weightKg: 90, reps: 5, sessionId: 1, achievedAt: 1 },
      { exerciseId: 'ohp',      weightKg: 55, reps: 5, sessionId: 1, achievedAt: 1 },
      { exerciseId: 'deadlift', weightKg: 140, reps: 3, sessionId: 1, achievedAt: 1 },
    ]).run();

    const m = await getPRsForExercises(db, ['bench', 'ohp']);
    expect(m.size).toBe(2);
    expect(m.get('bench')).toEqual({ weightKg: 90, reps: 5 });
    expect(m.get('ohp')).toEqual({ weightKg: 55, reps: 5 });
    expect(m.get('deadlift')).toBeUndefined();
  });

  it('returns an empty Map when called with an empty id list', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const m = await getPRsForExercises(db, []);
    expect(m.size).toBe(0);
  });
});
