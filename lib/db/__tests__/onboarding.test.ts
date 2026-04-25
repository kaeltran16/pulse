/** @jest-environment node */
import { eq } from 'drizzle-orm';

import { finishOnboarding, isOnboardingComplete } from '../queries/onboarding';
import { goals, rituals } from '../schema';
import { makeTestDb } from './test-helpers';

describe('isOnboardingComplete', () => {
  it('is false on a fresh DB', async () => {
    const { db } = makeTestDb();
    expect(await isOnboardingComplete(db)).toBe(false);
  });
});

describe('finishOnboarding', () => {
  it('inserts goals + active rituals in one go', async () => {
    const { db } = makeTestDb();
    await finishOnboarding(db, {
      dailyBudgetCents: 8500,
      dailyMoveMinutes: 60,
      activeRitualTitles: ['Morning pages', 'Stretch', 'Meditate'],
    });

    const goalRows = await db.select().from(goals);
    expect(goalRows).toHaveLength(1);
    expect(goalRows[0]).toMatchObject({
      id: 1,
      dailyBudgetCents: 8500,
      dailyMoveMinutes: 60,
      dailyRitualTarget: 3,
    });

    const ritualRows = await db.select().from(rituals).orderBy(rituals.position);
    expect(ritualRows.map((r) => r.title)).toEqual([
      'Morning pages',
      'Stretch',
      'Meditate',
    ]);
    expect(ritualRows.map((r) => r.position)).toEqual([0, 1, 2]);
    for (const r of ritualRows) expect(r.active).toBe(true);

    expect(await isOnboardingComplete(db)).toBe(true);
  });

  it('omits toggled-off rituals', async () => {
    const { db } = makeTestDb();
    await finishOnboarding(db, {
      dailyBudgetCents: 5000,
      dailyMoveMinutes: 45,
      activeRitualTitles: ['Inbox zero'],
    });
    const ritualRows = await db.select().from(rituals);
    expect(ritualRows.map((r) => r.title)).toEqual(['Inbox zero']);
  });

  it('uses INSERT OR REPLACE for the singleton goals row', async () => {
    const { db } = makeTestDb();
    await finishOnboarding(db, {
      dailyBudgetCents: 5000,
      dailyMoveMinutes: 45,
      activeRitualTitles: ['Stretch'],
    });
    await finishOnboarding(db, {
      dailyBudgetCents: 12000,
      dailyMoveMinutes: 90,
      activeRitualTitles: ['Stretch', 'Meditate'],
    });
    const goalRows = await db.select().from(goals).where(eq(goals.id, 1));
    expect(goalRows).toHaveLength(1);
    expect(goalRows[0].dailyBudgetCents).toBe(12000);
    expect(goalRows[0].dailyRitualTarget).toBe(2);
  });
});
