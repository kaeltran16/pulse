/** @jest-environment node */
import { getTodayAggregates, localDayBounds } from '../queries/today';
import { tsLocal, atLocal } from './test-helpers';

const asOf = atLocal(2026, 4, 25, 14); // Sat Apr 25 2026, 14:00 local

describe('localDayBounds', () => {
  it('spans local midnight to next local midnight', () => {
    const { startMs, endMs } = localDayBounds(asOf);
    expect(new Date(startMs).getHours()).toBe(0);
    expect(endMs - startMs).toBe(24 * 60 * 60 * 1000);
  });
});

describe('getTodayAggregates', () => {
  const goals = { dailyBudgetCents: 8500, dailyMoveMinutes: 60, dailyRitualTarget: 5 };
  const activeRituals = [
    { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 },
  ] as { id: number }[];

  it('zeros out for empty inputs', () => {
    const r = getTodayAggregates({
      asOf,
      goals,
      activeRituals,
      spending: [],
      movement: [],
      ritualEntries: [],
    });
    expect(r).toEqual({
      spentCents: 0,
      moveMinutes: 0,
      ritualsDone: 0,
      activeRitualCount: 5,
    });
  });

  it('excludes yesterday and tomorrow', () => {
    const r = getTodayAggregates({
      asOf,
      goals,
      activeRituals,
      spending: [
        { cents: 100, occurredAt: tsLocal(2026, 4, 24, 23) },
        { cents: 700, occurredAt: tsLocal(2026, 4, 25, 9) },
        { cents: 200, occurredAt: tsLocal(2026, 4, 26, 1) },
      ],
      movement: [
        { minutes: 30, occurredAt: tsLocal(2026, 4, 24, 22) },
        { minutes: 45, occurredAt: tsLocal(2026, 4, 25, 8) },
      ],
      ritualEntries: [
        { ritualId: 1, occurredAt: tsLocal(2026, 4, 24, 12) },
        { ritualId: 2, occurredAt: tsLocal(2026, 4, 25, 7) },
      ],
    });
    expect(r.spentCents).toBe(700);
    expect(r.moveMinutes).toBe(45);
    expect(r.ritualsDone).toBe(1);
  });

  it('dedupes a ritual logged twice in one day', () => {
    const r = getTodayAggregates({
      asOf,
      goals,
      activeRituals,
      spending: [],
      movement: [],
      ritualEntries: [
        { ritualId: 1, occurredAt: tsLocal(2026, 4, 25, 7) },
        { ritualId: 1, occurredAt: tsLocal(2026, 4, 25, 18) },
        { ritualId: 2, occurredAt: tsLocal(2026, 4, 25, 9) },
      ],
    });
    expect(r.ritualsDone).toBe(2);
  });

  it('ignores entries for inactive rituals', () => {
    const r = getTodayAggregates({
      asOf,
      goals,
      activeRituals: [{ id: 1 }, { id: 2 }],
      spending: [],
      movement: [],
      ritualEntries: [
        { ritualId: 1, occurredAt: tsLocal(2026, 4, 25, 7) },
        { ritualId: 99, occurredAt: tsLocal(2026, 4, 25, 8) }, // inactive
      ],
    });
    expect(r.ritualsDone).toBe(1);
    expect(r.activeRitualCount).toBe(2);
  });

  it('handles a DST spring-forward day correctly', () => {
    // 2026 US DST start is Sun Mar 8. 02:00 → 03:00.
    const dstAsOf = atLocal(2026, 3, 8, 14);
    const r = getTodayAggregates({
      asOf: dstAsOf,
      goals,
      activeRituals,
      spending: [
        { cents: 500, occurredAt: tsLocal(2026, 3, 7, 23) },
        { cents: 800, occurredAt: tsLocal(2026, 3, 8, 4) },
      ],
      movement: [],
      ritualEntries: [],
    });
    expect(r.spentCents).toBe(800);
  });
});
