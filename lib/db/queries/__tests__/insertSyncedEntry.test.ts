/** @jest-environment node */
import { makeTestDb } from '../../__tests__/test-helpers';
import { insertSyncedBatch } from '../insertSyncedEntry';

const sample = (id: number, recurring = false) => ({
  id,
  merchant: 'Blue Bottle',
  cents: 650,
  currency: 'USD',
  category: 'Food',
  occurredAt: 1_700_000_000_000,
  recurring,
  emailFrom: 'alerts@bank.com',
});

describe('insertSyncedBatch', () => {
  it('inserts each entry with all sync columns populated', () => {
    const { db, raw } = makeTestDb();
    insertSyncedBatch(db, [sample(1), sample(2, true)]);
    const rows = raw
      .prepare(
        `SELECT cents, currency, merchant, category, recurring, occurred_at, synced_entry_id
         FROM spending_entries
         ORDER BY synced_entry_id ASC`,
      )
      .all() as Array<{
      cents: number;
      currency: string;
      merchant: string;
      category: string;
      recurring: number;
      occurred_at: number;
      synced_entry_id: number;
    }>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      cents: 650,
      currency: 'USD',
      merchant: 'Blue Bottle',
      category: 'Food',
      recurring: 0,
      occurred_at: 1_700_000_000_000,
      synced_entry_id: 1,
    });
    expect(rows[1].recurring).toBe(1);
  });

  it('INSERT OR IGNORE no-ops on duplicate synced_entry_id', () => {
    const { db, raw } = makeTestDb();
    insertSyncedBatch(db, [sample(1)]);
    insertSyncedBatch(db, [sample(1)]);
    const count = raw.prepare('SELECT COUNT(*) AS n FROM spending_entries').get() as {
      n: number;
    };
    expect(count.n).toBe(1);
  });

  it('handles an empty batch', () => {
    const { db, raw } = makeTestDb();
    insertSyncedBatch(db, []);
    const count = raw.prepare('SELECT COUNT(*) AS n FROM spending_entries').get() as {
      n: number;
    };
    expect(count.n).toBe(0);
  });

  it('null merchant + category persisted as NULL', () => {
    const { db, raw } = makeTestDb();
    insertSyncedBatch(db, [
      {
        ...sample(1),
        merchant: null,
        category: null,
      },
    ]);
    const row = raw.prepare('SELECT merchant, category FROM spending_entries').get() as {
      merchant: string | null;
      category: string | null;
    };
    expect(row.merchant).toBeNull();
    expect(row.category).toBeNull();
  });
});
