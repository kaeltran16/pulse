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
