import { sql } from 'drizzle-orm';

import { type SyncedEntryDTO } from '../../api-types';
import { type AnyDb } from './onboarding';

// Inserts a batch of synced entries from the backend's GET /sync/entries response
// into the local spending_entries table. Idempotent via INSERT OR IGNORE on
// synced_entry_id (the partial unique index covers it).
//
// Hand-logged entries (merchant in `note`, no synced_entry_id) are unaffected.
export function insertSyncedBatch(db: AnyDb, entries: SyncedEntryDTO[]): void {
  if (entries.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  for (const e of entries) {
    dx.run(sql`
      INSERT OR IGNORE INTO spending_entries
        (cents, currency, merchant, category, recurring, occurred_at, synced_entry_id)
      VALUES
        (${e.cents}, ${e.currency}, ${e.merchant}, ${e.category},
         ${e.recurring ? 1 : 0}, ${e.occurredAt}, ${e.id})
    `);
  }
}
