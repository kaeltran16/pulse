/** @jest-environment node */
import { computeStrengthVolume, type StrengthSet } from '../volume';

describe('computeStrengthVolume', () => {
  it('returns 0 for an empty input', () => {
    expect(computeStrengthVolume([])).toBe(0);
  });

  it('sums reps × weight for fully-specified strength sets', () => {
    const sets: StrengthSet[] = [
      { reps: 5, weightKg: 80 },
      { reps: 5, weightKg: 85 },
      { reps: 5, weightKg: 90 },
    ];
    expect(computeStrengthVolume(sets)).toBe(1275);
  });

  it('excludes sets with null reps', () => {
    const sets: StrengthSet[] = [
      { reps: 5, weightKg: 80 },
      { reps: null, weightKg: 80 },
    ];
    expect(computeStrengthVolume(sets)).toBe(400);
  });

  it('excludes sets with null weight (bodyweight pull-ups do not add volume in v2)', () => {
    const sets: StrengthSet[] = [
      { reps: 8, weightKg: null },
      { reps: 5, weightKg: 80 },
    ];
    expect(computeStrengthVolume(sets)).toBe(400);
  });

  it('handles fractional weight', () => {
    const sets: StrengthSet[] = [{ reps: 5, weightKg: 92.5 }];
    expect(computeStrengthVolume(sets)).toBe(462.5);
  });
});
