/** @jest-environment node */
import { makeTestDb, atLocal, tsLocal } from '../../db/__tests__/test-helpers';
import { goals, spendingEntries, movementEntries, rituals } from '../../db/schema';
import { buildContext } from '../context';

describe('buildContext', () => {
  it('returns today aggregates + recent entries (capped)', async () => {
    const { db } = makeTestDb();
    db.insert(goals).values({ id: 1, dailyBudgetCents: 8500, dailyMoveMinutes: 60, dailyRitualTarget: 5 }).run();
    db.insert(rituals).values({ id: 1, title: 'Read', icon: '📖', position: 1 }).run();

    db.insert(spendingEntries).values({ cents: 575, note: 'Verve', category: 'coffee', occurredAt: tsLocal(2026, 4, 25, 8) }).run();
    db.insert(movementEntries).values({ minutes: 30, kind: 'run', note: null, occurredAt: tsLocal(2026, 4, 25, 7) }).run();

    const ctx = await buildContext(db, atLocal(2026, 4, 25, 14));
    expect(ctx.today.spentCents).toBe(575);
    expect(ctx.today.moveMinutes).toBe(30);
    expect(ctx.recentEntries.length).toBe(2);
    expect(ctx.recentEntries[0].kind).toBe('spend');
  });
});
