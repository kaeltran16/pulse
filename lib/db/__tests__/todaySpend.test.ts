/** @jest-environment node */
import { makeTestDb, atLocal, tsLocal } from './test-helpers';
import { getTodaySpend } from '../queries/todaySpend';
import { goals, spendingEntries } from '../schema';

describe('getTodaySpend', () => {
  it("aggregates only today's spend rows; orders desc; reads budget from goals", async () => {
    const { db } = makeTestDb();
    db.insert(goals).values({ id: 1, dailyBudgetCents: 8500, dailyMoveMinutes: 60, dailyRitualTarget: 5 }).run();

    db.insert(spendingEntries).values([
      { cents: 1620, note: 'Tartine',  category: 'food', occurredAt: tsLocal(2026, 4, 25, 12) },
      { cents:  575, note: 'Verve',    category: 'coffee', occurredAt: tsLocal(2026, 4, 25, 8) },
      { cents: 9999, note: 'Yesterday',category: null,    occurredAt: tsLocal(2026, 4, 24, 18) },
    ]).run();

    const r = await getTodaySpend(db, atLocal(2026, 4, 25, 14));
    expect(r.totalCents).toBe(1620 + 575);
    expect(r.budgetCents).toBe(8500);
    expect(r.entries.map((e) => e.note)).toEqual(['Tartine', 'Verve']);
  });

  it('returns zero total + zero budget when no goals row', async () => {
    const { db } = makeTestDb();
    const r = await getTodaySpend(db, atLocal(2026, 4, 25, 12));
    expect(r.totalCents).toBe(0);
    expect(r.budgetCents).toBe(0);
    expect(r.entries).toEqual([]);
  });
});
