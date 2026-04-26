/** @jest-environment node */
import { getInFlightBadges, wouldThisSetBeAPR } from '../in-flight-pr';
import type { PRSnapshot } from '../pr-detection';

describe('getInFlightBadges', () => {
  it('returns all-false when snapshot is empty and there are no sets', () => {
    expect(getInFlightBadges(new Map(), [])).toEqual([]);
  });

  it('flags every set that beats the snapshot', () => {
    const snapshot: PRSnapshot = new Map([['bench', { weightKg: 80, reps: 5 }]]);
    const sets = [
      { exerciseId: 'bench', exercisePosition: 0, setPosition: 0, reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null },
      { exerciseId: 'bench', exercisePosition: 0, setPosition: 1, reps: 5, weightKg: 85, durationSeconds: null, distanceKm: null },
      { exerciseId: 'bench', exercisePosition: 0, setPosition: 2, reps: 5, weightKg: 90, durationSeconds: null, distanceKm: null },
    ];
    expect(getInFlightBadges(snapshot, sets)).toEqual([false, true, true]);
  });

  it('flags every set when no prior PR exists', () => {
    const sets = [
      { exerciseId: 'ohp', exercisePosition: 0, setPosition: 0, reps: 6, weightKg: 50, durationSeconds: null, distanceKm: null },
      { exerciseId: 'ohp', exercisePosition: 0, setPosition: 1, reps: 6, weightKg: 52.5, durationSeconds: null, distanceKm: null },
    ];
    expect(getInFlightBadges(new Map(), sets)).toEqual([true, true]);
  });

  it('ignores cardio sets (reps or weightKg null)', () => {
    const sets = [
      { exerciseId: 'treadmill', exercisePosition: 0, setPosition: 0, reps: null, weightKg: null, durationSeconds: 1800, distanceKm: 5 },
    ];
    expect(getInFlightBadges(new Map(), sets)).toEqual([false]);
  });
});

describe('wouldThisSetBeAPR', () => {
  it('returns true when no prior PR exists', () => {
    expect(wouldThisSetBeAPR(new Map(), 'bench', 5, 80)).toBe(true);
  });

  it('returns true when reps*weight beats the prior PR', () => {
    const snap: PRSnapshot = new Map([['bench', { weightKg: 80, reps: 5 }]]);
    expect(wouldThisSetBeAPR(snap, 'bench', 5, 85)).toBe(true);
  });

  it('returns false when reps*weight equals the prior PR', () => {
    const snap: PRSnapshot = new Map([['bench', { weightKg: 80, reps: 5 }]]);
    expect(wouldThisSetBeAPR(snap, 'bench', 5, 80)).toBe(false);
  });

  it('returns false when reps or weight is null', () => {
    expect(wouldThisSetBeAPR(new Map(), 'bench', null, 80)).toBe(false);
    expect(wouldThisSetBeAPR(new Map(), 'bench', 5, null)).toBe(false);
  });
});
