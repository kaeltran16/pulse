/** @jest-environment node */
import { streakForRitual } from '../queries/streaks';
import { atLocal, tsLocal } from './test-helpers';

const asOf = atLocal(2026, 4, 25, 14);

describe('streakForRitual', () => {
  it('is 0 with no entries', () => {
    expect(streakForRitual({ ritualEntries: [], ritualId: 1, asOf })).toBe(0);
  });

  it('is 1 when logged today only', () => {
    expect(
      streakForRitual({
        ritualEntries: [{ ritualId: 1, occurredAt: tsLocal(2026, 4, 25, 7) }],
        ritualId: 1,
        asOf,
      }),
    ).toBe(1);
  });

  it('is 2 when logged today and yesterday', () => {
    expect(
      streakForRitual({
        ritualEntries: [
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 25, 7) },
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 24, 7) },
        ],
        ritualId: 1,
        asOf,
      }),
    ).toBe(2);
  });

  it('counts only the run ending today/yesterday when there is a gap', () => {
    expect(
      streakForRitual({
        ritualEntries: [
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 25, 7) },
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 24, 7) },
          // gap on Apr 23
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 22, 7) },
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 21, 7) },
        ],
        ritualId: 1,
        asOf,
      }),
    ).toBe(2);
  });

  it('still counts when last log is yesterday but not today', () => {
    expect(
      streakForRitual({
        ritualEntries: [
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 24, 7) },
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 23, 7) },
        ],
        ritualId: 1,
        asOf,
      }),
    ).toBe(2);
  });

  it('is 0 when last log is 3+ days ago', () => {
    expect(
      streakForRitual({
        ritualEntries: [
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 22, 7) },
        ],
        ritualId: 1,
        asOf,
      }),
    ).toBe(0);
  });

  it('only counts entries for the matching ritualId', () => {
    expect(
      streakForRitual({
        ritualEntries: [
          { ritualId: 2, occurredAt: tsLocal(2026, 4, 25, 7) },
          { ritualId: 2, occurredAt: tsLocal(2026, 4, 24, 7) },
        ],
        ritualId: 1,
        asOf,
      }),
    ).toBe(0);
  });

  it('increments correctly across DST spring-forward', () => {
    // 2026 US DST: Sun Mar 8. Streak across Mar 7→8.
    const dstAsOf = atLocal(2026, 3, 8, 20);
    expect(
      streakForRitual({
        ritualEntries: [
          { ritualId: 1, occurredAt: tsLocal(2026, 3, 8, 9) },
          { ritualId: 1, occurredAt: tsLocal(2026, 3, 7, 9) },
          { ritualId: 1, occurredAt: tsLocal(2026, 3, 6, 9) },
        ],
        ritualId: 1,
        asOf: dstAsOf,
      }),
    ).toBe(3);
  });
});
