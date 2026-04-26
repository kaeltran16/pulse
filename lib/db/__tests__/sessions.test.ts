/** @jest-environment node */
import { eq } from 'drizzle-orm';

import {
  listSessions,
  getSession,
  type CompletedSessionDraft,
} from '../queries/sessions';
import { movementEntries, prs, sessions, sessionSets } from '../schema';
import { seedWorkouts } from '../seed-workouts';
import { makeTestDb, insertCompletedSessionForTests } from './test-helpers';

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

describe('completed-session lifecycle (start → upsert → finalize)', () => {
  it('writes a session row with computed totals (parity with old insertCompletedSession)', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const result = await insertCompletedSessionForTests(db, baseDraft());

    expect(result.sessionId).toBeGreaterThan(0);
    expect(result.totalVolumeKg).toBe(1575);
    expect(result.prCount).toBe(2);
  });

  it('writes session_sets rows in order with is_pr correctly flagged', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await insertCompletedSessionForTests(db, baseDraft());

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
    await insertCompletedSessionForTests(db, baseDraft());

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
    await insertCompletedSessionForTests(db, draft);

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
    await insertCompletedSessionForTests(db, baseDraft());
    await insertCompletedSessionForTests(db, baseDraft({
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
});

describe('listSessions / getSession', () => {
  it('listSessions returns most-recent-first', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSessionForTests(db, baseDraft({ startedAt: 1_000_000, finishedAt: 1_500_000 }));
    await insertCompletedSessionForTests(db, baseDraft({ startedAt: 2_000_000, finishedAt: 2_500_000 }));
    const list = await listSessions(db);
    expect(list).toHaveLength(2);
    expect(list[0].startedAt).toBe(2_000_000);
    expect(list[1].startedAt).toBe(1_000_000);
  });

  it('listSessions honors limit', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSessionForTests(db, baseDraft({ startedAt: 1_000_000, finishedAt: 1_500_000 }));
    await insertCompletedSessionForTests(db, baseDraft({ startedAt: 2_000_000, finishedAt: 2_500_000 }));
    const list = await listSessions(db, { limit: 1 });
    expect(list).toHaveLength(1);
  });

  it('getSession returns the full session including ordered sets', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await insertCompletedSessionForTests(db, baseDraft());
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

import { upsertDraftSet } from '../queries/sessions';

describe('upsertDraftSet', () => {
  async function freshDraft() {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_500_000,
    });
    return { db, raw, sessionId };
  }

  it('inserts a new row when no row at (sessionId, exercisePosition, setPosition) exists', async () => {
    const { db, raw, sessionId } = await freshDraft();
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 0,
      reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null,
    });
    const rows = raw.prepare(`SELECT * FROM session_sets WHERE session_id = ?`).all(sessionId) as Array<{
      exercise_id: string; exercise_position: number; set_position: number;
      reps: number; weight_kg: number; is_pr: number;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ exercise_id: 'bench', exercise_position: 0, set_position: 0, reps: 5, weight_kg: 80, is_pr: 0 });
  });

  it('replaces an existing row at the same (sessionId, exercisePosition, setPosition)', async () => {
    const { db, raw, sessionId } = await freshDraft();
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 0,
      reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null,
    });
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 0,
      reps: 6, weightKg: 82.5, durationSeconds: null, distanceKm: null,
    });
    const rows = raw.prepare(`SELECT * FROM session_sets WHERE session_id = ?`).all(sessionId) as Array<{
      reps: number; weight_kg: number;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reps: 6, weight_kg: 82.5 });
  });

  it('keeps isPr=0 even if the caller provides truthy data — finalize sets the flag', async () => {
    const { db, raw, sessionId } = await freshDraft();
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 0,
      reps: 100, weightKg: 999, durationSeconds: null, distanceKm: null,
    });
    const row = raw.prepare(`SELECT is_pr FROM session_sets WHERE session_id = ?`).get(sessionId) as { is_pr: number };
    expect(row.is_pr).toBe(0);
  });

  it('supports cardio sets (durationSeconds + distanceKm, reps/weightKg null)', async () => {
    const { db, raw, sessionId } = await freshDraft();
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'treadmill', exercisePosition: 0, setPosition: 0,
      reps: null, weightKg: null, durationSeconds: 1800, distanceKm: 5.0,
    });
    const row = raw.prepare(`SELECT * FROM session_sets WHERE session_id = ?`).get(sessionId) as {
      reps: number | null; weight_kg: number | null; duration_seconds: number; distance_km: number;
    };
    expect(row.reps).toBeNull();
    expect(row.weight_kg).toBeNull();
    expect(row.duration_seconds).toBe(1800);
    expect(row.distance_km).toBe(5.0);
  });

  it('allows multiple sets at different (exercisePosition, setPosition) keys', async () => {
    const { db, raw, sessionId } = await freshDraft();
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 0, reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null,
    });
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 1, reps: 5, weightKg: 85, durationSeconds: null, distanceKm: null,
    });
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'ohp',   exercisePosition: 1, setPosition: 0, reps: 6, weightKg: 50, durationSeconds: null, distanceKm: null,
    });
    const count = raw.prepare(`SELECT COUNT(*) AS c FROM session_sets WHERE session_id = ?`).get(sessionId) as { c: number };
    expect(count.c).toBe(3);
  });
});

import { discardDraftSession, deleteDraftSet } from '../queries/sessions';

describe('discardDraftSession', () => {
  it('deletes the draft session row', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_500_000,
    });
    await discardDraftSession(db, sessionId);
    const count = raw.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE id = ?`).get(sessionId) as { c: number };
    expect(count.c).toBe(0);
  });

  it('cascades to delete session_sets', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_500_000,
    });
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 0,
      reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null,
    });
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 1,
      reps: 5, weightKg: 85, durationSeconds: null, distanceKm: null,
    });
    await discardDraftSession(db, sessionId);
    const count = raw.prepare(`SELECT COUNT(*) AS c FROM session_sets WHERE session_id = ?`).get(sessionId) as { c: number };
    expect(count.c).toBe(0);
  });

  it('is a no-op when the session does not exist', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await expect(discardDraftSession(db, 99999)).resolves.toBeUndefined();
  });
});

describe('deleteDraftSet', () => {
  it('deletes a single set by (sessionId, exercisePosition, setPosition) without touching others', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_500_000,
    });
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 0, reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null,
    });
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 1, reps: 5, weightKg: 85, durationSeconds: null, distanceKm: null,
    });
    await deleteDraftSet(db, sessionId, 0, 0);
    const remaining = raw.prepare(`SELECT set_position FROM session_sets WHERE session_id = ?`).all(sessionId) as Array<{ set_position: number }>;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].set_position).toBe(1);
  });

  it('is a no-op when the row does not exist', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_500_000,
    });
    await expect(deleteDraftSet(db, sessionId, 9, 9)).resolves.toBeUndefined();
  });
});

import { finalizeSession, type SessionSetDraft } from '../queries/sessions';
import { type TestDb } from './test-helpers';

async function loadDraftWith(db: TestDb, sessionId: number, sets: SessionSetDraft[]) {
  for (const s of sets) {
    await upsertDraftSet(db, sessionId, s);
  }
}

const benchSets: SessionSetDraft[] = [
  { exerciseId: 'bench', exercisePosition: 0, setPosition: 0, reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null },
  { exerciseId: 'bench', exercisePosition: 0, setPosition: 1, reps: 5, weightKg: 85, durationSeconds: null, distanceKm: null },
  { exerciseId: 'bench', exercisePosition: 0, setPosition: 2, reps: 5, weightKg: 90, durationSeconds: null, distanceKm: null },
  { exerciseId: 'ohp',   exercisePosition: 1, setPosition: 0, reps: 6, weightKg: 50, durationSeconds: null, distanceKm: null },
];

describe('finalizeSession', () => {
  it('flips status to completed and sets finishedAt + durationSeconds', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_000_000,
    });
    await loadDraftWith(db, sessionId, benchSets);
    const finishedAt = 1_000_000 + 60 * 52 * 1000;
    const result = await finalizeSession(db, sessionId, finishedAt);

    expect(result.sessionId).toBe(sessionId);
    expect(result.totalVolumeKg).toBe(1575);
    expect(result.prCount).toBe(2);

    const row = raw.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId) as {
      status: string; finished_at: number | null; duration_seconds: number;
      total_volume_kg: number; pr_count: number;
    };
    expect(row.status).toBe('completed');
    expect(row.finished_at).toBe(finishedAt);
    expect(row.duration_seconds).toBe(60 * 52);
    expect(row.total_volume_kg).toBe(1575);
    expect(row.pr_count).toBe(2);
  });

  it('marks isPr=1 on session_sets that beat the snapshot', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_000_000,
    });
    await loadDraftWith(db, sessionId, benchSets);
    await finalizeSession(db, sessionId, 1_000_000 + 60 * 52 * 1000);

    const rows = raw.prepare(`SELECT exercise_id, set_position, is_pr FROM session_sets WHERE session_id = ?`).all(sessionId) as Array<{
      exercise_id: string; set_position: number; is_pr: number;
    }>;
    expect(rows.every((r) => r.is_pr === 1)).toBe(true);
    expect(rows).toHaveLength(4);
  });

  it('upserts the prs table to best-of-session per exercise', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_000_000,
    });
    await loadDraftWith(db, sessionId, benchSets);
    await finalizeSession(db, sessionId, 1_000_000 + 60 * 52 * 1000);

    const prRows = raw.prepare(`SELECT exercise_id, weight_kg, reps FROM prs`).all() as Array<{
      exercise_id: string; weight_kg: number; reps: number;
    }>;
    expect(prRows).toHaveLength(2);
    const bench = prRows.find((r) => r.exercise_id === 'bench')!;
    const ohp = prRows.find((r) => r.exercise_id === 'ohp')!;
    expect(bench).toMatchObject({ weight_kg: 90, reps: 5 });
    expect(ohp).toMatchObject({ weight_kg: 50, reps: 6 });
  });

  it('inserts a movement_entries row keyed to finishedAt', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_000_000,
    });
    await loadDraftWith(db, sessionId, benchSets);
    const finishedAt = 1_000_000 + 60 * 52 * 1000;
    await finalizeSession(db, sessionId, finishedAt);

    const m = raw.prepare(`SELECT * FROM movement_entries`).all() as Array<{
      minutes: number; kind: string; note: string; occurred_at: number;
    }>;
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ minutes: 52, kind: 'workout', note: 'Push Day A', occurred_at: finishedAt });
  });

  it('handles cardio sessions (no PRs, volume = 0)', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: null, routineNameSnapshot: 'Treadmill', startedAt: 1_000_000,
    });
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'treadmill', exercisePosition: 0, setPosition: 0,
      reps: null, weightKg: null, durationSeconds: 1800, distanceKm: 5.0,
    });
    const result = await finalizeSession(db, sessionId, 1_000_000 + 1_800_000);
    expect(result.totalVolumeKg).toBe(0);
    expect(result.prCount).toBe(0);
    const m = raw.prepare(`SELECT minutes, kind FROM movement_entries`).all() as Array<{ minutes: number; kind: string }>;
    expect(m).toHaveLength(1);
    expect(m[0].minutes).toBe(30);
    expect(m[0].kind).toBe('workout');
  });

  it('rolls back the entire transaction if a PR upsert fails', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_000_000,
    });
    // Manually corrupt: insert a session_set with an invalid exercise_id by bypassing FK.
    raw.pragma('foreign_keys = OFF');
    raw.prepare(`INSERT INTO session_sets (session_id, exercise_id, exercise_position, set_position, reps, weight_kg, duration_seconds, distance_km, is_pr)
                 VALUES (?, 'NOT-AN-EXERCISE', 0, 1, 5, 80, NULL, NULL, 0)`).run(sessionId);
    raw.pragma('foreign_keys = ON');

    await expect(finalizeSession(db, sessionId, 1_000_000 + 60 * 52 * 1000)).rejects.toThrow();

    const status = (raw.prepare(`SELECT status FROM sessions WHERE id = ?`).get(sessionId) as { status: string }).status;
    expect(status).toBe('draft');
    const movementCount = (raw.prepare(`SELECT COUNT(*) AS c FROM movement_entries`).get() as { c: number }).c;
    expect(movementCount).toBe(0);
  });

  it('throws when the session does not exist', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await expect(finalizeSession(db, 99999, 1_000_000)).rejects.toThrow(/not found/i);
  });

  it('throws when the session is already completed', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_000_000,
    });
    await loadDraftWith(db, sessionId, benchSets);
    await finalizeSession(db, sessionId, 1_000_000 + 60 * 52 * 1000);
    await expect(finalizeSession(db, sessionId, 2_000_000)).rejects.toThrow(/not a draft/i);
  });
});
