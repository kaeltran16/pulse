/** @jest-environment node */
import { computeMuscleDistribution, computeWeeklyVolumeSeries, selectTopPRs } from '../post-session-aggregate';

const meta = {
  bench:    { name: 'Bench Press',    muscle: 'Chest',     group: 'Push' },
  ohp:      { name: 'Overhead Press', muscle: 'Shoulders', group: 'Push' },
  triceps:  { name: 'Tricep Pushdown',muscle: 'Triceps',   group: 'Push' },
  treadmil: { name: 'Treadmill',      muscle: '',          group: 'Cardio' },
};

const set = (
  exerciseId: string,
  weightKg: number | null,
  reps: number | null,
) => ({
  id: 0,
  sessionId: 0,
  exerciseId,
  exercisePosition: 0,
  setPosition: 0,
  reps,
  weightKg,
  durationSeconds: null,
  distanceKm: null,
  isPr: 0,
});

describe('computeMuscleDistribution', () => {
  it('returns empty array when no sets', () => {
    expect(computeMuscleDistribution([], meta)).toEqual([]);
  });

  it('sums volume per muscle and sorts desc by tonnage', () => {
    const sets = [
      set('bench',   80, 5),  // 400 chest
      set('bench',   85, 5),  // 425 chest -> total 825
      set('ohp',     50, 6),  // 300 shoulders
      set('triceps', 30, 10), // 300 triceps
    ];
    const out = computeMuscleDistribution(sets, meta);
    expect(out.map((m) => m.muscle)).toEqual(['Chest', 'Shoulders', 'Triceps']);
    expect(out[0].tonnageKg).toBe(825);
    expect(out[1].tonnageKg).toBe(300);
    expect(out[2].tonnageKg).toBe(300);
  });

  it('percentages are integers and sum to 99 or 100', () => {
    const sets = [
      set('bench',   80, 5),  // 400
      set('ohp',     50, 6),  // 300
      set('triceps', 30, 10), // 300
    ];
    const out = computeMuscleDistribution(sets, meta);
    const sum = out.reduce((s, m) => s + m.percentage, 0);
    expect(out.every((m) => Number.isInteger(m.percentage))).toBe(true);
    expect(sum === 99 || sum === 100).toBe(true);
  });

  it('excludes cardio sets (null weight or reps)', () => {
    const sets = [
      set('bench', 80, 5),
      { ...set('treadmil', null, null), durationSeconds: 1800, distanceKm: 5 },
    ];
    const out = computeMuscleDistribution(sets, meta);
    expect(out).toHaveLength(1);
    expect(out[0].muscle).toBe('Chest');
  });

  it('skips contributions for unknown exercise ids without crashing', () => {
    const sets = [
      set('bench', 80, 5),
      set('ghost', 50, 5),
    ];
    const out = computeMuscleDistribution(sets, meta);
    expect(out).toHaveLength(1);
    expect(out[0].muscle).toBe('Chest');
  });
});

const session = (finishedAt: number, totalVolumeKg: number) => ({ finishedAt, totalVolumeKg });

// Wednesday April 22, 2026 14:00 local
const NOW = new Date(2026, 3, 22, 14, 0, 0).getTime();

describe('computeWeeklyVolumeSeries', () => {
  it('returns weeksBack zeros when no sessions', () => {
    const out = computeWeeklyVolumeSeries([], 8, NOW);
    expect(out).toHaveLength(8);
    expect(out.every((b) => b.tonnageKg === 0)).toBe(true);
  });

  it('places this-week session in the last bucket', () => {
    const today = new Date(2026, 3, 22, 12, 0, 0).getTime();
    const out = computeWeeklyVolumeSeries([session(today, 1000)], 8, NOW);
    expect(out[7].tonnageKg).toBe(1000);
    expect(out.slice(0, 7).every((b) => b.tonnageKg === 0)).toBe(true);
  });

  it('places last-week session in the second-to-last bucket', () => {
    const lastWeek = new Date(2026, 3, 15, 12, 0, 0).getTime();
    const out = computeWeeklyVolumeSeries([session(lastWeek, 800)], 8, NOW);
    expect(out[6].tonnageKg).toBe(800);
    expect(out[7].tonnageKg).toBe(0);
  });

  it('sums multiple sessions in the same week', () => {
    const monday = new Date(2026, 3, 20, 9, 0, 0).getTime();   // Mon
    const wednesday = new Date(2026, 3, 22, 9, 0, 0).getTime(); // Wed
    const out = computeWeeklyVolumeSeries(
      [session(monday, 500), session(wednesday, 700)],
      8,
      NOW,
    );
    expect(out[7].tonnageKg).toBe(1200);
  });

  it('ignores sessions older than weeksBack', () => {
    // 10 weeks ago
    const ancient = new Date(2026, 1, 11, 12, 0, 0).getTime();
    const out = computeWeeklyVolumeSeries([session(ancient, 999)], 8, NOW);
    expect(out.every((b) => b.tonnageKg === 0)).toBe(true);
  });

  it('returns buckets oldest first with monotonically increasing weekStart', () => {
    const out = computeWeeklyVolumeSeries([], 8, NOW);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].weekStart).toBeGreaterThan(out[i - 1].weekStart);
    }
  });

  it('handles "now" on a Sunday correctly (week starts Monday)', () => {
    const sundayNow = new Date(2026, 3, 26, 14, 0, 0).getTime(); // Sun Apr 26 2026
    const sundaySession = new Date(2026, 3, 26, 9, 0, 0).getTime();
    const out = computeWeeklyVolumeSeries([session(sundaySession, 600)], 8, sundayNow);
    expect(out[7].tonnageKg).toBe(600); // current week is Mon Apr 20–Sun Apr 26
  });
});

describe('selectTopPRs', () => {
  const exMeta = {
    bench: { name: 'Bench Press',    muscle: 'Chest',     group: 'Push' },
    ohp:   { name: 'Overhead Press', muscle: 'Shoulders', group: 'Push' },
    squat: { name: 'Back Squat',     muscle: 'Quads',     group: 'Legs' },
  };

  const prInput = (exerciseId: string, weightKg: number, reps: number) => ({
    exerciseId,
    weightKg,
    reps,
  });

  it('returns empty top + 0 more when no PRs', () => {
    const out = selectTopPRs([], exMeta);
    expect(out).toEqual({ top: [], more: 0 });
  });

  it('caps top at N (default 2) and reports the rest in more', () => {
    const out = selectTopPRs(
      [prInput('bench', 90, 5), prInput('ohp', 50, 6), prInput('squat', 105, 5)],
      exMeta,
    );
    expect(out.top).toHaveLength(2);
    expect(out.more).toBe(1);
  });

  it('sorts by newWeightKg descending', () => {
    const out = selectTopPRs(
      [prInput('ohp', 50, 6), prInput('bench', 90, 5), prInput('squat', 105, 5)],
      exMeta,
      5,
    );
    expect(out.top.map((p) => p.exerciseId)).toEqual(['squat', 'bench', 'ohp']);
  });

  it('hydrates exerciseName from meta', () => {
    const out = selectTopPRs([prInput('bench', 90, 5)], exMeta);
    expect(out.top[0].exerciseName).toBe('Bench Press');
    expect(out.top[0].newWeightKg).toBe(90);
    expect(out.top[0].newReps).toBe(5);
  });

  it('falls back to exerciseId when meta is missing', () => {
    const out = selectTopPRs([prInput('ghost', 30, 5)], exMeta);
    expect(out.top[0].exerciseName).toBe('ghost');
  });

  it('deduplicates per exerciseId, keeping the best by weight × reps', () => {
    const out = selectTopPRs(
      [prInput('bench', 80, 5), prInput('bench', 90, 5), prInput('bench', 85, 5)],
      exMeta,
      5,
    );
    expect(out.top).toHaveLength(1);
    expect(out.top[0].newWeightKg).toBe(90);
  });
});
