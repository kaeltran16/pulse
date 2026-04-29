/** @jest-environment node */
import { periodBounds, lastCompletedPeriodKey } from '../reviewAggregates';

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
