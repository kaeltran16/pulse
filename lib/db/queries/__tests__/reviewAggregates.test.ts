/** @jest-environment node */
import { periodBounds, lastCompletedPeriodKey, computeReviewAggregates } from '../reviewAggregates';
import { makeTestDb } from '../../__tests__/test-helpers';
import { rituals, ritualEntries, spendingEntries, sessions, prs, exercises, goals } from '../../schema';

describe('periodBounds', () => {
  it('weekly: returns Mon 00:00 to next Mon 00:00 for an offset of 0', () => {
    // Anchor: Wed 2026-04-29
    const anchor = new Date(2026, 3, 29, 12, 0, 0);
    const b = periodBounds('weekly', anchor, 0);
    // Mon 2026-04-27 00:00 .. Mon 2026-05-04 00:00
    expect(new Date(b.startMs).toString()).toContain('Apr 27 2026');
    expect(new Date(b.endMs).toString()).toContain('May 04 2026');
    expect(b.key).toBe('2026-W18');
  });

  it('weekly: offset -1 returns the previous ISO week', () => {
    const anchor = new Date(2026, 3, 29, 12, 0, 0);
    const b = periodBounds('weekly', anchor, -1);
    expect(b.key).toBe('2026-W17');
  });

  it('weekly: ISO year boundary — Jan 1 2027 is Friday, falls in 2026-W53', () => {
    const anchor = new Date(2027, 0, 1, 12, 0, 0);
    const b = periodBounds('weekly', anchor, 0);
    expect(b.key).toBe('2026-W53');
  });

  it('monthly: returns 1st 00:00 to next 1st 00:00 for offset 0', () => {
    const anchor = new Date(2026, 3, 15, 12, 0, 0); // Apr 15
    const b = periodBounds('monthly', anchor, 0);
    expect(new Date(b.startMs).toString()).toContain('Apr 01 2026');
    expect(new Date(b.endMs).toString()).toContain('May 01 2026');
    expect(b.key).toBe('2026-04');
  });

  it('monthly: offset -1 returns the previous month', () => {
    const anchor = new Date(2026, 3, 15, 12, 0, 0);
    const b = periodBounds('monthly', anchor, -1);
    expect(b.key).toBe('2026-03');
  });

  it('monthly: rolls back across year boundary', () => {
    const anchor = new Date(2026, 0, 15, 12, 0, 0); // Jan 15
    const b = periodBounds('monthly', anchor, -1);
    expect(b.key).toBe('2025-12');
  });
});

describe('lastCompletedPeriodKey', () => {
  it('weekly: Wed → returns the prior week (last completed Mon..Sun)', () => {
    const wed = new Date(2026, 3, 29, 12, 0, 0);
    expect(lastCompletedPeriodKey('weekly', wed)).toBe('2026-W17');
  });

  it('weekly: Mon morning → returns the week that ended yesterday', () => {
    const mon = new Date(2026, 3, 27, 9, 0, 0);
    expect(lastCompletedPeriodKey('weekly', mon)).toBe('2026-W17');
  });

  it('monthly: 15th → returns the prior month', () => {
    const d = new Date(2026, 3, 15, 12, 0, 0);
    expect(lastCompletedPeriodKey('monthly', d)).toBe('2026-03');
  });

  it('monthly: 1st of month → returns the prior month', () => {
    const d = new Date(2026, 3, 1, 9, 0, 0);
    expect(lastCompletedPeriodKey('monthly', d)).toBe('2026-03');
  });
});

function seedRitual(db: any, title: string, color: string = 'rituals'): number {
  const r = db
    .insert(rituals)
    .values({ title, icon: 'star.fill', cadence: 'daily', color, position: 0 })
    .returning({ id: rituals.id })
    .all();
  return r[0].id;
}

describe('computeReviewAggregates', () => {
  it('weekly: counts ritual entries, spending, sessions in [startMs, endMs)', async () => {
    const { db } = makeTestDb();
    const ritualId = seedRitual(db, 'meditate');
    const wed = new Date(2026, 3, 29, 12).getTime();
    db.insert(ritualEntries).values({ ritualId, occurredAt: wed }).run();
    db.insert(spendingEntries)
      .values({ cents: 1500, category: 'dining', occurredAt: wed, currency: 'USD' })
      .run();
    db.insert(goals).values({ id: 1, dailyBudgetCents: 5000, dailyMoveMinutes: 30, dailyRitualTarget: 3 }).run();

    const aggs = await computeReviewAggregates(db as any, 'weekly', '2026-W18');
    expect(aggs.spend.totalMinor).toBe(1500);
    expect(aggs.spend.byDayOfWeek[2]).toBe(1500); // Wed = index 2 (Mon=0)
    expect(aggs.spend.topMerchant).toBeNull();
    expect(aggs.rituals.kept).toBe(1);
    expect(aggs.rituals.goalTotal).toBe(3 * 7);
    expect(aggs.workouts.sessions).toBe(0);
    expect(aggs.workouts.prCount).toBe(0);
  });

  it('weekly: byCategory + topMerchant resolve correctly', async () => {
    const { db } = makeTestDb();
    const wed = new Date(2026, 3, 29, 12).getTime();
    db.insert(spendingEntries)
      .values([
        { cents: 1500, category: 'dining', merchant: 'Verve', occurredAt: wed, currency: 'USD' },
        { cents: 4000, category: 'groceries', merchant: "Trader Joe's", occurredAt: wed, currency: 'USD' },
        { cents: 800, category: 'dining', merchant: 'Verve', occurredAt: wed, currency: 'USD' },
      ])
      .run();
    const aggs = await computeReviewAggregates(db as any, 'weekly', '2026-W18');
    expect(aggs.spend.byCategory.dining).toBe(2300);
    expect(aggs.spend.byCategory.groceries).toBe(4000);
    expect(aggs.spend.topMerchant).toEqual({ name: "Trader Joe's", totalMinor: 4000 });
  });

  it('monthly: bestStreakRitual is null when no ritual has a streak >= 1', async () => {
    const { db } = makeTestDb();
    seedRitual(db, 'meditate');
    db.insert(goals).values({ id: 1, dailyBudgetCents: 5000, dailyMoveMinutes: 30, dailyRitualTarget: 1 }).run();
    const aggs = await computeReviewAggregates(db as any, 'monthly', '2026-04');
    expect(aggs.rituals.bestStreakRitual).toBeNull();
  });

  it('monthly: counts sessions and PRs by occurrence time', async () => {
    const { db } = makeTestDb();
    const apr15 = new Date(2026, 3, 15, 12).getTime();
    const may1 = new Date(2026, 4, 1, 12).getTime();
    db.insert(exercises).values({ id: 'bench', name: 'Bench', group: 'push', muscle: 'chest', equipment: 'bb', kind: 'strength', sfSymbol: 'figure.strengthtraining.functional' }).run();
    db.insert(sessions).values([
      { routineNameSnapshot: 'A', status: 'completed', startedAt: apr15, finishedAt: apr15 + 1, prCount: 1 },
      { routineNameSnapshot: 'B', status: 'completed', startedAt: may1, finishedAt: may1 + 1, prCount: 0 },
    ]).run();
    db.insert(prs).values({ exerciseId: 'bench', weightKg: 100, reps: 5, sessionId: 1, achievedAt: apr15 }).run();
    db.insert(goals).values({ id: 1, dailyBudgetCents: 5000, dailyMoveMinutes: 30, dailyRitualTarget: 1 }).run();
    const aggs = await computeReviewAggregates(db as any, 'monthly', '2026-04');
    expect(aggs.workouts.sessions).toBe(1);
    expect(aggs.workouts.prCount).toBe(1);
  });
});
