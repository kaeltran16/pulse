import { sql, isNotNull, desc } from 'drizzle-orm';

import { spendingEntries } from '../schema';
import { type AnyDb } from './onboarding';

export type SyncedRow = {
  id: number;
  cents: number;
  merchant: string | null;
  category: string | null;
  currency: string;
  recurring: boolean;
  occurredAt: number;
  syncedEntryId: number;
};

export function recentSynced(db: AnyDb, limit = 6): SyncedRow[] {
  const rows = db
    .select({
      id: spendingEntries.id,
      cents: spendingEntries.cents,
      merchant: spendingEntries.merchant,
      category: spendingEntries.category,
      currency: spendingEntries.currency,
      recurring: spendingEntries.recurring,
      occurredAt: spendingEntries.occurredAt,
      syncedEntryId: spendingEntries.syncedEntryId,
    })
    .from(spendingEntries)
    .where(isNotNull(spendingEntries.syncedEntryId))
    .orderBy(desc(spendingEntries.occurredAt))
    .limit(limit)
    .all() as Array<SyncedRow & { syncedEntryId: number | null }>;
  return rows.filter((r): r is SyncedRow => r.syncedEntryId !== null);
}
