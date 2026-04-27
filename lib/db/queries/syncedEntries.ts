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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const rows = dx
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

export const MS_PER_DAY_30 = 30 * 24 * 60 * 60 * 1000;

export type SubscriptionGroup = {
  merchant: string;
  category: string | null;
  currency: string;
  lastCents: number;
  lastSeenAt: number;
  count: number;
  monthlyAmountCents: number;
  predictedNextChargeAt: number;
};

export function subscriptionList(db: AnyDb): SubscriptionGroup[] {
  const dx = db as unknown as { all: (q: unknown) => Array<{
    merchant: string;
    category: string | null;
    currency: string;
    lastCents: number;
    lastSeenAt: number;
    count: number;
  }> };
  const rows = dx.all(sql`
    SELECT
      se.merchant AS merchant,
      MAX(se.occurred_at) AS lastSeenAt,
      COUNT(*) AS count,
      MAX(se.currency) AS currency,
      (SELECT inner1.cents FROM spending_entries inner1
         WHERE inner1.merchant = se.merchant
           AND inner1.synced_entry_id IS NOT NULL
           AND inner1.recurring = 1
         ORDER BY inner1.occurred_at DESC LIMIT 1) AS lastCents,
      (SELECT inner2.category FROM spending_entries inner2
         WHERE inner2.merchant = se.merchant
           AND inner2.synced_entry_id IS NOT NULL
           AND inner2.recurring = 1
         ORDER BY inner2.occurred_at DESC LIMIT 1) AS category
    FROM spending_entries se
    WHERE se.synced_entry_id IS NOT NULL
      AND se.recurring = 1
      AND se.merchant IS NOT NULL
    GROUP BY se.merchant
    ORDER BY lastSeenAt ASC
  `);
  return rows.map((r) => ({
    merchant: r.merchant,
    category: r.category,
    currency: r.currency,
    lastCents: Number(r.lastCents),
    lastSeenAt: Number(r.lastSeenAt),
    count: Number(r.count),
    monthlyAmountCents: Number(r.lastCents),
    predictedNextChargeAt: Number(r.lastSeenAt) + MS_PER_DAY_30,
  }));
}
