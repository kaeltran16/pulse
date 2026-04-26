/** @jest-environment node */
import { projectRestActivity } from '../projection';
import type { ActiveSessionState, ExerciseInSession } from '@/lib/state/activeSessionStore';
import type { SessionSetDraft } from '@/lib/db/queries/sessions';

const exercise = (
  id: string,
  name: string,
  prescribed: Array<{ reps: number | null; weightKg: number | null }>,
  position = 0,
): ExerciseInSession => ({
  exerciseId: id,
  position,
  prescribedSets: prescribed.map((p) => ({
    reps: p.reps,
    weightKg: p.weightKg,
    durationSeconds: null,
    distanceKm: null,
  })),
  meta: {
    name,
    equipment: 'barbell',
    muscle: 'chest',
    sfSymbol: 'dumbbell.fill',
    kind: 'strength',
  },
});

const draft = (exPos: number, setPos: number): SessionSetDraft => ({
  exerciseId: `ex-${exPos}`,
  exercisePosition: exPos,
  setPosition: setPos,
  reps: 8,
  weightKg: 80,
  durationSeconds: null,
  distanceKm: null,
});

function baseState(overrides: Partial<ActiveSessionState>): ActiveSessionState {
  return {
    phase: 'active',
    mode: 'strength',
    sessionId: 1,
    routineId: 1,
    routineNameSnapshot: 'Test routine',
    restDefaultSeconds: 120,
    startedAt: 1_000,
    exercises: [],
    currentExerciseIdx: 0,
    prSnapshot: new Map(),
    setDrafts: [],
    rest: { status: 'idle' },
    // The action methods are unused by projection — cast keeps the type happy.
    ...overrides,
  } as ActiveSessionState;
}

describe('projectRestActivity', () => {
  it('rest running mid-exercise → next-set subtitle with weight × reps', () => {
    const ex0 = exercise('ex-0', 'Bench Press', [
      { reps: 8, weightKg: 80 },
      { reps: 8, weightKg: 80 },
      { reps: 8, weightKg: 80 },
    ]);
    const state = baseState({
      exercises: [ex0],
      currentExerciseIdx: 0,
      setDrafts: [draft(0, 0), draft(0, 1)],
      rest: { status: 'running', startedAt: 5_000, durationMs: 90_000 },
    });

    const out = projectRestActivity(state);

    expect(out).not.toBeNull();
    expect(out!.title).toBe('Bench Press');
    expect(out!.subtitle).toBe('Set 3 of 3 · 80 kg × 8');
    expect(out!.progressBar?.date).toBe(5_000 + 90_000);
    expect(out!.imageName).toBe('rest_timer');
    expect(out!.dynamicIslandImageName).toBe('rest_timer');
  });

  it('rest running, just auto-advanced to next exercise → "Set 1 of N" subtitle', () => {
    const ex0 = exercise('ex-0', 'Bench Press', [{ reps: 8, weightKg: 80 }]);
    const ex1 = exercise(
      'ex-1',
      'Overhead Press',
      [{ reps: 5, weightKg: 50 }, { reps: 5, weightKg: 50 }],
      1,
    );
    const state = baseState({
      exercises: [ex0, ex1],
      currentExerciseIdx: 1,                       // store auto-advanced
      setDrafts: [draft(0, 0)],                    // no sets logged on ex1 yet
      rest: { status: 'running', startedAt: 5_000, durationMs: 60_000 },
    });

    const out = projectRestActivity(state);

    expect(out).not.toBeNull();
    expect(out!.title).toBe('Overhead Press');
    expect(out!.subtitle).toBe('Set 1 of 2 · 50 kg × 5');
  });

  it('last rest of last exercise → "Last rest · finish when ready"', () => {
    const ex0 = exercise('ex-0', 'Bench Press', [{ reps: 8, weightKg: 80 }]);
    const state = baseState({
      exercises: [ex0],
      currentExerciseIdx: 0,
      setDrafts: [draft(0, 0)],                    // all prescribed sets logged
      rest: { status: 'running', startedAt: 5_000, durationMs: 60_000 },
    });

    const out = projectRestActivity(state);

    expect(out).not.toBeNull();
    expect(out!.title).toBe('Bench Press');
    expect(out!.subtitle).toBe('Last rest · finish when ready');
  });

  it('prescribed weight is null → drops "kg ×" segment', () => {
    const ex0 = exercise('ex-0', 'Pull-ups', [
      { reps: 8, weightKg: null },
      { reps: 8, weightKg: null },
      { reps: 8, weightKg: null },
    ]);
    const state = baseState({
      exercises: [ex0],
      currentExerciseIdx: 0,
      setDrafts: [draft(0, 0), draft(0, 1)],
      rest: { status: 'running', startedAt: 5_000, durationMs: 60_000 },
    });

    const out = projectRestActivity(state);

    expect(out!.subtitle).toBe('Set 3 of 3 · 8 reps');
  });

  it('cardio session → returns null', () => {
    const state = baseState({
      mode: 'cardio',
      rest: { status: 'running', startedAt: 5_000, durationMs: 60_000 },
    });

    expect(projectRestActivity(state)).toBeNull();
  });

  it('rest idle → returns null', () => {
    const ex0 = exercise('ex-0', 'Bench Press', [{ reps: 8, weightKg: 80 }]);
    const state = baseState({
      exercises: [ex0],
      currentExerciseIdx: 0,
      rest: { status: 'idle' },
    });

    expect(projectRestActivity(state)).toBeNull();
  });

  it.each(['idle', 'hydrating', 'finalizing'] as const)(
    'phase=%s → returns null',
    (phase) => {
      const ex0 = exercise('ex-0', 'Bench Press', [{ reps: 8, weightKg: 80 }]);
      const state = baseState({
        phase,
        exercises: [ex0],
        rest: { status: 'running', startedAt: 5_000, durationMs: 60_000 },
      });

      expect(projectRestActivity(state)).toBeNull();
    },
  );
});
