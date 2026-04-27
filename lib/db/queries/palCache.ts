import { sql } from 'drizzle-orm';

import { type AnyDb } from './onboarding';

export function readCache<T>(db: AnyDb, key: string, maxAgeMs?: number): T | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const rows = dx.all(sql`
    SELECT value, fetched_at AS fetchedAt FROM pal_cache WHERE key = ${key}
  `) as Array<{ value: string; fetchedAt: number }>;
  if (rows.length === 0) return null;
  const row = rows[0];
  if (maxAgeMs != null && Date.now() - Number(row.fetchedAt) > maxAgeMs) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export function writeCache(db: AnyDb, key: string, value: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  dx.run(sql`
    INSERT OR REPLACE INTO pal_cache (key, value, fetched_at)
    VALUES (${key}, ${JSON.stringify(value)}, ${Date.now()})
  `);
}

export function deleteCacheByPrefix(db: AnyDb, prefix: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  dx.run(sql`DELETE FROM pal_cache WHERE key LIKE ${prefix + '%'}`);
}

export function vacuumStaleNudges(db: AnyDb, todayKey: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  dx.run(sql`
    DELETE FROM pal_cache
    WHERE key LIKE 'nudge:%'
      AND key NOT LIKE ${'nudge:' + todayKey + ':%'}
  `);
}
