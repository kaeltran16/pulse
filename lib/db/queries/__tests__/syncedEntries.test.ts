/** @jest-environment node */
import { makeTestDb } from '../../__tests__/test-helpers';
import { insertSyncedBatch } from '../insertSyncedEntry';
import { recentSynced } from '../syncedEntries';

const sample = (id: number, occurredAt: number, recurring = false) => ({
  id,
  merchant: `Merchant ${id}`,
  cents: 100 * id,
  currency: 'USD',
  category: 'Food',
  occurredAt,
  recurring,
  emailFrom: 'alerts@bank.com',
});

describe('recentSynced', () => {
  it('returns at most `limit` rows', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      sample(1, 1_000),
      sample(2, 2_000),
      sample(3, 3_000),
      sample(4, 4_000),
    ]);
    const rows = recentSynced(db, 2);
    expect(rows).toHaveLength(2);
  });

  it('orders by occurred_at desc', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      sample(1, 1_000),
      sample(2, 3_000),
      sample(3, 2_000),
    ]);
    const rows = recentSynced(db, 10);
    expect(rows.map((r) => r.syncedEntryId)).toEqual([2, 3, 1]);
  });

  it('excludes hand-logged entries (synced_entry_id IS NULL)', () => {
    const { db, raw } = makeTestDb();
    raw.prepare(
      `INSERT INTO spending_entries (cents, occurred_at, note) VALUES (500, 5000, 'cash coffee')`,
    ).run();
    insertSyncedBatch(db, [sample(1, 1_000)]);
    const rows = recentSynced(db, 10);
    expect(rows).toHaveLength(1);
    expect(rows[0].syncedEntryId).toBe(1);
  });

  it('returns [] on empty table', () => {
    const { db } = makeTestDb();
    expect(recentSynced(db, 10)).toEqual([]);
  });
});

import { syncedStats } from '../syncedEntries';

describe('syncedStats', () => {
  it('thisMonth counts only current local-month rows', () => {
    const { db } = makeTestDb();
    const now = new Date();
    const thisMonthTs = new Date(now.getFullYear(), now.getMonth(), 15, 12).getTime();
    const lastMonthTs = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12).getTime();
    insertSyncedBatch(db, [
      sample(1, thisMonthTs),
      sample(2, thisMonthTs),
      sample(3, lastMonthTs),
    ]);
    expect(syncedStats(db).thisMonth).toBe(2);
  });

  it('thisMonth boundary case: row at 23:59:59 on last day of prior month is excluded', () => {
    const { db } = makeTestDb();
    const now = new Date();
    const lastDayPriorMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
    insertSyncedBatch(db, [sample(1, lastDayPriorMonth)]);
    expect(syncedStats(db).thisMonth).toBe(0);
  });

  it('allTime counts all synced rows regardless of date', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      sample(1, 1_000),
      sample(2, 2_000_000_000_000),
    ]);
    expect(syncedStats(db).allTime).toBe(2);
  });

  it('recurringMerchants = COUNT DISTINCT merchant', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      { ...sample(1, 1_000, true), merchant: 'Netflix' },
      { ...sample(2, 2_000, true), merchant: 'Netflix' },
      { ...sample(3, 3_000, true), merchant: 'Spotify' },
      { ...sample(4, 4_000, false), merchant: 'OnceOff' },
      { ...sample(5, 5_000, true), merchant: null },
    ]);
    expect(syncedStats(db).recurringMerchants).toBe(2);
  });

  it('excludes hand-logged from all three counts', () => {
    const { db, raw } = makeTestDb();
    raw.prepare(
      `INSERT INTO spending_entries (cents, occurred_at, note, recurring) VALUES (500, 5000, 'cash', 1)`,
    ).run();
    expect(syncedStats(db)).toEqual({ thisMonth: 0, allTime: 0, recurringMerchants: 0 });
  });
});

import { subscriptionList, MS_PER_DAY_30 } from '../syncedEntries';

describe('subscriptionList', () => {
  it('groups multiple receipts per merchant into one entry', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      { ...sample(1, 1_000, true), merchant: 'Netflix', cents: 1599 },
      { ...sample(2, 2_000, true), merchant: 'Netflix', cents: 1599 },
      { ...sample(3, 3_000, true), merchant: 'Spotify', cents: 1099 },
    ]);
    const rows = subscriptionList(db);
    expect(rows.map((r) => r.merchant).sort()).toEqual(['Netflix', 'Spotify']);
  });

  it('lastCents = cents of the most recent occurrence', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      { ...sample(1, 1_000, true), merchant: 'Netflix', cents: 1499 },
      { ...sample(2, 2_000, true), merchant: 'Netflix', cents: 1599 },
    ]);
    const rows = subscriptionList(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].lastCents).toBe(1599);
    expect(rows[0].monthlyAmountCents).toBe(1599);
  });

  it('lastSeenAt = max(occurred_at) per merchant', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      { ...sample(1, 1_000, true), merchant: 'Netflix' },
      { ...sample(2, 5_000, true), merchant: 'Netflix' },
      { ...sample(3, 3_000, true), merchant: 'Netflix' },
    ]);
    const rows = subscriptionList(db);
    expect(rows[0].lastSeenAt).toBe(5_000);
  });

  it('predictedNextChargeAt = lastSeenAt + 30 days', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      { ...sample(1, 1_000_000, true), merchant: 'Netflix' },
    ]);
    const rows = subscriptionList(db);
    expect(rows[0].predictedNextChargeAt).toBe(1_000_000 + MS_PER_DAY_30);
  });

  it('sorts by predictedNextChargeAt ASC', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      { ...sample(1, 5_000, true), merchant: 'A' },
      { ...sample(2, 1_000, true), merchant: 'B' },
      { ...sample(3, 3_000, true), merchant: 'C' },
    ]);
    const rows = subscriptionList(db);
    expect(rows.map((r) => r.merchant)).toEqual(['B', 'C', 'A']);
  });

  it('excludes recurring=0 merchants', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      { ...sample(1, 1_000, false), merchant: 'OnceOff' },
      { ...sample(2, 2_000, true), merchant: 'Netflix' },
    ]);
    const rows = subscriptionList(db);
    expect(rows.map((r) => r.merchant)).toEqual(['Netflix']);
  });

  it('excludes merchant=NULL', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      { ...sample(1, 1_000, true), merchant: null },
      { ...sample(2, 2_000, true), merchant: 'Netflix' },
    ]);
    const rows = subscriptionList(db);
    expect(rows.map((r) => r.merchant)).toEqual(['Netflix']);
  });
});
