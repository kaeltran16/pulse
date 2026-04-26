/** @jest-environment node */
import { eq } from 'drizzle-orm';

import {
  insertCompletedSession,
  listSessions,
  getSession,
  type CompletedSessionDraft,
} from '../queries/sessions';
import { movementEntries, prs, sessions, sessionSets } from '../schema';
import { seedWorkouts } from '../seed-workouts';
import { makeTestDb } from './test-helpers';

const baseDraft = (overrides: Partial<CompletedSessionDraft> = {}): CompletedSessionDraft => ({
  routineId: 1,
  routineNameSnapshot: 'Push Day A',
  startedAt: 1_000_000,
  finishedAt: 1_000_000 + 60 * 52 * 1000,
  sets: [
    { exerciseId: 'bench', exercisePosition: 0, setPosition: 0, reps: 5, weightKg: 80,  durationSeconds: null, distanceKm: null },
    { exerciseId: 'bench', exercisePosition: 0, setPosition: 1, reps: 5, weightKg: 85,  durationSeconds: null, distanceKm: null },
    { exerciseId: 'bench', exercisePosition: 0, setPosition: 2, reps: 5, weightKg: 90,  durationSeconds: null, distanceKm: null },
    { exerciseId: 'ohp',   exercisePosition: 1, setPosition: 0, reps: 6, weightKg: 50,  durationSeconds: null, distanceKm: null },
  ],
  ...overrides,
});

describe('insertCompletedSession', () => {
  it('writes a session row with computed totals', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const result = await insertCompletedSession(db, baseDraft());

    expect(result.sessionId).toBeGreaterThan(0);
    expect(result.totalVolumeKg).toBe(1575);
    expect(result.prCount).toBe(2);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = (await (db as any).select().from(sessions).where(eq(sessions.id, result.sessionId)))[0];
    expect(row.totalVolumeKg).toBe(1575);
    expect(row.prCount).toBe(2);
    expect(row.durationSeconds).toBe(60 * 52);
    expect(row.routineNameSnapshot).toBe('Push Day A');
  });

  it('writes session_sets rows in order with is_pr correctly flagged', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await insertCompletedSession(db, baseDraft());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (db as any).select().from(sessionSets).where(eq(sessionSets.sessionId, sessionId));
    expect(rows).toHaveLength(4);
    const bench3rd = rows.find((r: { exerciseId: string; setPosition: number }) => r.exerciseId === 'bench' && r.setPosition === 2);
    const ohp1st  = rows.find((r: { exerciseId: string; setPosition: number }) => r.exerciseId === 'ohp'   && r.setPosition === 0);
    expect(bench3rd.isPr).toBe(1);
    expect(ohp1st.isPr).toBe(1);
    const bench1st = rows.find((r: { exerciseId: string; setPosition: number }) => r.exerciseId === 'bench' && r.setPosition === 0);
    const bench2nd = rows.find((r: { exerciseId: string; setPosition: number }) => r.exerciseId === 'bench' && r.setPosition === 1);
    expect(bench1st.isPr).toBe(1);
    expect(bench2nd.isPr).toBe(1);
  });

  it('upserts the prs table to best-of-session per exercise', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSession(db, baseDraft());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (db as any).select().from(prs);
    expect(rows).toHaveLength(2);
    const bench = rows.find((r: { exerciseId: string }) => r.exerciseId === 'bench')!;
    const ohp   = rows.find((r: { exerciseId: string }) => r.exerciseId === 'ohp')!;
    expect(bench).toMatchObject({ exerciseId: 'bench', weightKg: 90, reps: 5 });
    expect(ohp).toMatchObject({ exerciseId: 'ohp',   weightKg: 50, reps: 6 });
  });

  it('inserts a movement_entries row for the workout', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const draft = baseDraft();
    await insertCompletedSession(db, draft);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = await (db as any).select().from(movementEntries);
    expect(m).toHaveLength(1);
    expect(m[0].minutes).toBe(52);
    expect(m[0].kind).toBe('workout');
    expect(m[0].note).toBe('Push Day A');
    expect(m[0].occurredAt).toBe(draft.finishedAt);
  });

  it('does not duplicate prs rows for the same exercise across two sessions; updates instead', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSession(db, baseDraft());
    await insertCompletedSession(db, baseDraft({
      startedAt: 2_000_000,
      finishedAt: 2_000_000 + 60 * 30 * 1000,
      sets: [
        { exerciseId: 'bench', exercisePosition: 0, setPosition: 0, reps: 5, weightKg: 95, durationSeconds: null, distanceKm: null },
      ],
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (db as any).select().from(prs);
    const benchRows = rows.filter((r: { exerciseId: string }) => r.exerciseId === 'bench');
    expect(benchRows).toHaveLength(1);
    expect(benchRows[0]).toMatchObject({ weightKg: 95, reps: 5 });
  });

  it('rolls back the entire write if an inner insert throws (e.g. bad exercise FK)', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const bad = baseDraft({
      sets: [
        { exerciseId: 'NOT-AN-EXERCISE', exercisePosition: 0, setPosition: 0, reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null },
      ],
    });
    await expect(insertCompletedSession(db, bad)).rejects.toThrow();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((await (db as any).select().from(sessions)).length).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((await (db as any).select().from(sessionSets)).length).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((await (db as any).select().from(movementEntries)).length).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((await (db as any).select().from(prs)).length).toBe(0);
  });
});

describe('listSessions / getSession', () => {
  it('listSessions returns most-recent-first', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSession(db, baseDraft({ startedAt: 1_000_000, finishedAt: 1_500_000 }));
    await insertCompletedSession(db, baseDraft({ startedAt: 2_000_000, finishedAt: 2_500_000 }));
    const list = await listSessions(db);
    expect(list).toHaveLength(2);
    expect(list[0].startedAt).toBe(2_000_000);
    expect(list[1].startedAt).toBe(1_000_000);
  });

  it('listSessions honors limit', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSession(db, baseDraft({ startedAt: 1_000_000, finishedAt: 1_500_000 }));
    await insertCompletedSession(db, baseDraft({ startedAt: 2_000_000, finishedAt: 2_500_000 }));
    const list = await listSessions(db, { limit: 1 });
    expect(list).toHaveLength(1);
  });

  it('getSession returns the full session including ordered sets', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await insertCompletedSession(db, baseDraft());
    const full = await getSession(db, sessionId);
    expect(full).not.toBeNull();
    expect(full!.id).toBe(sessionId);
    expect(full!.sets).toHaveLength(4);
    expect(full!.sets[0]).toMatchObject({ exerciseId: 'bench', setPosition: 0 });
    expect(full!.sets[3]).toMatchObject({ exerciseId: 'ohp',   setPosition: 0 });
  });

  it('getSession returns null for a missing id', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    expect(await getSession(db, 9999)).toBeNull();
  });
});

import { getOpenDraft } from '../queries/sessions';

describe('getOpenDraft', () => {
  it('returns null when no draft exists', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const draft = await getOpenDraft(db);
    expect(draft).toBeNull();
  });

  it('returns the draft session with its sets when one exists', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    raw.prepare(`INSERT INTO sessions (routine_id, routine_name_snapshot, status, started_at, finished_at)
                 VALUES (?, ?, 'draft', ?, NULL)`).run(1, 'Push Day A', 1_000_000);
    const sessionId = (raw.prepare(`SELECT id FROM sessions WHERE status='draft'`).get() as { id: number }).id;
    raw.prepare(`INSERT INTO session_sets
                 (session_id, exercise_id, exercise_position, set_position, reps, weight_kg, duration_seconds, distance_km, is_pr)
                 VALUES (?, 'bench', 0, 0, 5, 80, NULL, NULL, 0)`).run(sessionId);
    raw.prepare(`INSERT INTO session_sets
                 (session_id, exercise_id, exercise_position, set_position, reps, weight_kg, duration_seconds, distance_km, is_pr)
                 VALUES (?, 'bench', 0, 1, 5, 85, NULL, NULL, 0)`).run(sessionId);

    const draft = await getOpenDraft(db);
    expect(draft).not.toBeNull();
    expect(draft!.id).toBe(sessionId);
    expect(draft!.routineId).toBe(1);
    expect(draft!.routineNameSnapshot).toBe('Push Day A');
    expect(draft!.startedAt).toBe(1_000_000);
    expect(draft!.sets).toHaveLength(2);
    expect(draft!.sets[0]).toMatchObject({ exerciseId: 'bench', setPosition: 0, reps: 5, weightKg: 80 });
    expect(draft!.sets[1]).toMatchObject({ exerciseId: 'bench', setPosition: 1, reps: 5, weightKg: 85 });
  });

  it('orders sets by (exercisePosition, setPosition)', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    raw.prepare(`INSERT INTO sessions (routine_id, routine_name_snapshot, status, started_at)
                 VALUES (?, ?, 'draft', ?)`).run(1, 'Push Day A', 1_000_000);
    const sessionId = (raw.prepare(`SELECT id FROM sessions WHERE status='draft'`).get() as { id: number }).id;
    raw.prepare(`INSERT INTO session_sets
                 (session_id, exercise_id, exercise_position, set_position, reps, weight_kg, duration_seconds, distance_km, is_pr)
                 VALUES (?, 'ohp', 1, 0, 6, 50, NULL, NULL, 0)`).run(sessionId);
    raw.prepare(`INSERT INTO session_sets
                 (session_id, exercise_id, exercise_position, set_position, reps, weight_kg, duration_seconds, distance_km, is_pr)
                 VALUES (?, 'bench', 0, 1, 5, 85, NULL, NULL, 0)`).run(sessionId);
    raw.prepare(`INSERT INTO session_sets
                 (session_id, exercise_id, exercise_position, set_position, reps, weight_kg, duration_seconds, distance_km, is_pr)
                 VALUES (?, 'bench', 0, 0, 5, 80, NULL, NULL, 0)`).run(sessionId);

    const draft = await getOpenDraft(db);
    expect(draft!.sets.map((s) => `${s.exercisePosition}:${s.setPosition}`)).toEqual(['0:0', '0:1', '1:0']);
  });
});

import { startDraftSession, DraftAlreadyOpenError } from '../queries/sessions';

describe('startDraftSession', () => {
  it('inserts a draft row with finishedAt=null and returns sessionId', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1,
      routineNameSnapshot: 'Push Day A',
      startedAt: 1_500_000,
    });
    expect(sessionId).toBeGreaterThan(0);
    const row = raw.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId) as {
      status: string; routine_id: number; routine_name_snapshot: string;
      started_at: number; finished_at: number | null; duration_seconds: number;
    };
    expect(row.status).toBe('draft');
    expect(row.routine_id).toBe(1);
    expect(row.routine_name_snapshot).toBe('Push Day A');
    expect(row.started_at).toBe(1_500_000);
    expect(row.finished_at).toBeNull();
    expect(row.duration_seconds).toBe(0);
  });

  it('throws DraftAlreadyOpenError when a draft already exists', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await startDraftSession(db, { routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_500_000 });
    await expect(
      startDraftSession(db, { routineId: 2, routineNameSnapshot: 'Pull Day A', startedAt: 1_600_000 })
    ).rejects.toThrow(DraftAlreadyOpenError);
  });

  it('allows starting a new draft after the previous one is finalized or discarded', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const first = await startDraftSession(db, { routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_500_000 });
    raw.prepare(`UPDATE sessions SET status='completed', finished_at = ? WHERE id = ?`).run(1_600_000, first.sessionId);
    const second = await startDraftSession(db, { routineId: 2, routineNameSnapshot: 'Pull Day A', startedAt: 1_700_000 });
    expect(second.sessionId).not.toBe(first.sessionId);
  });

  it('accepts a null routineId for ad-hoc / freestyle sessions', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: null,
      routineNameSnapshot: 'Freestyle',
      startedAt: 1_500_000,
    });
    const row = raw.prepare(`SELECT routine_id FROM sessions WHERE id = ?`).get(sessionId) as { routine_id: number | null };
    expect(row.routine_id).toBeNull();
  });
});
