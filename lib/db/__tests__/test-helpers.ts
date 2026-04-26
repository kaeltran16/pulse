/** @jest-environment node */
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

import * as schema from '../schema';

export type TestDb = BetterSQLite3Database<typeof schema>;

export function makeTestDb(): { db: TestDb; raw: Database.Database } {
  const raw = new Database(':memory:');
  raw.pragma('foreign_keys = ON');
  const db = drizzle(raw, { schema });
  migrate(db, { migrationsFolder: path.resolve(__dirname, '../migrations') });
  return { db, raw };
}

/** Construct a Date at local-TZ midnight + the given offsets. */
export function atLocal(year: number, month: number, day: number, hour = 12): Date {
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

/** ms-since-epoch for a local-time tuple. */
export function tsLocal(year: number, month: number, day: number, hour = 12): number {
  return atLocal(year, month, day, hour).getTime();
}

import {
  startDraftSession,
  upsertDraftSet,
  finalizeSession,
  type CompletedSessionDraft,
} from '../queries/sessions';

/**
 * Builds a completed session via the new lifecycle (start → upsert × N → finalize).
 * Used by tests that just need a populated completed session as a fixture.
 */
export async function insertCompletedSessionForTests(
  db: TestDb,
  draft: CompletedSessionDraft,
): Promise<{ sessionId: number; prCount: number; totalVolumeKg: number }> {
  const { sessionId } = await startDraftSession(db, {
    routineId: draft.routineId,
    routineNameSnapshot: draft.routineNameSnapshot,
    startedAt: draft.startedAt,
  });
  for (const s of draft.sets) {
    await upsertDraftSet(db, sessionId, {
      exerciseId: s.exerciseId,
      exercisePosition: s.exercisePosition,
      setPosition: s.setPosition,
      reps: s.reps,
      weightKg: s.weightKg,
      durationSeconds: s.durationSeconds,
      distanceKm: s.distanceKm,
    });
  }
  return finalizeSession(db, sessionId, draft.finishedAt);
}
