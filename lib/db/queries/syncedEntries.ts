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

export type SyncedStats = {
  thisMonth: number;
  allTime: number;
  recurringMerchants: number;
};

function startOfMonthLocalMs(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
}

export function syncedStats(db: AnyDb, now: Date = new Date()): SyncedStats {
  const startMs = startOfMonthLocalMs(now);
  const dx = db as unknown as { run: (q: unknown) => unknown; all: (q: unknown) => Array<{ n?: number }> };
  const all = dx.all(sql`
    SELECT
      (SELECT COUNT(*) FROM spending_entries
        WHERE synced_entry_id IS NOT NULL AND occurred_at >= ${startMs}) AS thisMonth,
      (SELECT COUNT(*) FROM spending_entries
        WHERE synced_entry_id IS NOT NULL) AS allTime,
      (SELECT COUNT(DISTINCT merchant) FROM spending_entries
        WHERE synced_entry_id IS NOT NULL AND recurring = 1 AND merchant IS NOT NULL) AS recurringMerchants
  `) as Array<{ thisMonth: number; allTime: number; recurringMerchants: number }>;
  const row = all[0] ?? { thisMonth: 0, allTime: 0, recurringMerchants: 0 };
  return {
    thisMonth: Number(row.thisMonth) || 0,
    allTime: Number(row.allTime) || 0,
    recurringMerchants: Number(row.recurringMerchants) || 0,
  };
}
