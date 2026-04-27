import { sql } from 'drizzle-orm';

import { DEFAULT_RITUALS } from '../seed-defaults';
import { type AnyDb } from './onboarding';

/**
 * Idempotent insert of DEFAULT_RITUALS rows whose title isn't already present.
 * New rows get position = MAX(position) + 1 (or 0 on a fresh table).
 *
 * Run once at app startup after migrations apply, so already-onboarded users
 * pick up new default rituals (e.g., the Water row added in SP5e) without
 * re-running onboarding.
 */
export function reseedDefaults(db: AnyDb): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  for (const def of DEFAULT_RITUALS) {
    dx.run(sql`
      INSERT INTO rituals (title, icon, cadence, color, active, position)
      SELECT ${def.title}, ${def.icon}, ${def.cadence}, ${def.color}, 1,
             COALESCE((SELECT MAX(position) + 1 FROM rituals), 0)
      WHERE NOT EXISTS (SELECT 1 FROM rituals WHERE title = ${def.title})
    `);
  }
}
