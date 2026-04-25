/** @jest-environment node */
import { detectSessionPRs, type PRSnapshot, type SessionSetInput } from '../pr-detection';

const snapshotOf = (entries: Array<[string, number, number]>): PRSnapshot =>
  new Map(entries.map(([id, w, r]) => [id, { weightKg: w, reps: r }]));

describe('detectSessionPRs', () => {
  it('returns an empty result for empty input', () => {
    const r = detectSessionPRs(new Map(), []);
    expect(r.isPrPerSet).toEqual([]);
    expect(r.newPRs.size).toBe(0);
  });

  it('flags the first valid set as PR when no snapshot exists for the exercise', () => {
    const sets: SessionSetInput[] = [
      { exerciseId: 'bench', reps: 5, weightKg: 80 },
    ];
    const r = detectSessionPRs(new Map(), sets);
    expect(r.isPrPerSet).toEqual([true]);
    expect(r.newPRs.get('bench')).toEqual({ weightKg: 80, reps: 5, setIndex: 0 });
  });

  it('flags a set strictly beating the snapshot', () => {
    const snap = snapshotOf([['bench', 80, 5]]);
    const sets: SessionSetInput[] = [
      { exerciseId: 'bench', reps: 5, weightKg: 85 },
    ];
    const r = detectSessionPRs(snap, sets);
    expect(r.isPrPerSet).toEqual([true]);
    expect(r.newPRs.get('bench')).toEqual({ weightKg: 85, reps: 5, setIndex: 0 });
  });

  it('does not flag a tie against the snapshot', () => {
    const snap = snapshotOf([['bench', 80, 5]]);
    const sets: SessionSetInput[] = [
      { exerciseId: 'bench', reps: 5, weightKg: 80 },
    ];
    const r = detectSessionPRs(snap, sets);
    expect(r.isPrPerSet).toEqual([false]);
    expect(r.newPRs.size).toBe(0);
  });

  it('keeps best-of-session per exercise when multiple sets PR', () => {
    const snap = snapshotOf([['bench', 80, 5]]);
    const sets: SessionSetInput[] = [
      { exerciseId: 'bench', reps: 5, weightKg: 85 },
      { exerciseId: 'bench', reps: 5, weightKg: 90 },
      { exerciseId: 'bench', reps: 5, weightKg: 85 },
    ];
    const r = detectSessionPRs(snap, sets);
    expect(r.isPrPerSet).toEqual([true, true, true]);
    expect(r.newPRs.size).toBe(1);
    expect(r.newPRs.get('bench')).toEqual({ weightKg: 90, reps: 5, setIndex: 1 });
  });

  it('never flags cardio sets (null reps or null weight)', () => {
    const sets: SessionSetInput[] = [
      { exerciseId: 'treadmill', reps: null, weightKg: null },
      { exerciseId: 'pullup',    reps: 8,    weightKg: null },
    ];
    const r = detectSessionPRs(new Map(), sets);
    expect(r.isPrPerSet).toEqual([false, false]);
    expect(r.newPRs.size).toBe(0);
  });

  it('preserves input order in isPrPerSet', () => {
    const sets: SessionSetInput[] = [
      { exerciseId: 'bench', reps: 5, weightKg: 80 },
      { exerciseId: 'ohp',   reps: 5, weightKg: 50 },
      { exerciseId: 'bench', reps: 5, weightKg: 85 },
    ];
    const snap = snapshotOf([
      ['bench', 80, 5],
      ['ohp',   50, 5],
    ]);
    const r = detectSessionPRs(snap, sets);
    expect(r.isPrPerSet).toEqual([false, false, true]);
    expect(r.newPRs.size).toBe(1);
    expect(r.newPRs.get('bench')?.setIndex).toBe(2);
  });
});
