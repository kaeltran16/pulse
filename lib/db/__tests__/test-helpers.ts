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
