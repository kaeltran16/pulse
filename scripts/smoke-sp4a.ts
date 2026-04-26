/* eslint-disable @typescript-eslint/no-require-imports, no-console */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

import { startDraftSession, upsertDraftSet, finalizeSession, listSessions } from '../lib/db/queries/sessions';
import * as schema from '../lib/db/schema';
import { seedWorkouts } from '../lib/db/seed-workouts';

async function main() {
  const raw = new Database(':memory:');
  raw.pragma('foreign_keys = ON');
  const db = drizzle(raw, { schema });
  migrate(db, { migrationsFolder: path.resolve(__dirname, '../lib/db/migrations') });
  seedWorkouts(db);

  const exercises = (raw.prepare('SELECT COUNT(*) AS n FROM exercises').get() as { n: number }).n;
  const routines  = (raw.prepare('SELECT COUNT(*) AS n FROM routines').get() as { n: number }).n;
  if (exercises !== 21) throw new Error(`Expected 21 exercises, got ${exercises}`);
  if (routines !== 6)   throw new Error(`Expected 6 routines, got ${routines}`);

  const sets = [
    { exerciseId: 'bench', exercisePosition: 0, setPosition: 0, reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null },
    { exerciseId: 'bench', exercisePosition: 0, setPosition: 1, reps: 5, weightKg: 90, durationSeconds: null, distanceKm: null },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { sessionId } = await startDraftSession(db as any, {
    routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_000_000,
  });
  for (const s of sets) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await upsertDraftSet(db as any, sessionId, s);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await finalizeSession(db as any, sessionId, 1_000_000 + 60 * 52 * 1000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = await listSessions(db as any);
  if (list.length !== 1) throw new Error(`Expected 1 session, got ${list.length}`);
  if (list[0].id !== result.sessionId) throw new Error('Session id mismatch');
  if (list[0].totalVolumeKg !== 5 * 80 + 5 * 90) throw new Error(`Wrong volume: ${list[0].totalVolumeKg}`);

  console.log('SP4a smoke test OK', { exercises, routines, session: result });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
