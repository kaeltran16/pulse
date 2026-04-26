import { create } from 'zustand';
import { router } from 'expo-router';

import { db } from '@/lib/db/client';
import {
  startDraftSession,
  upsertDraftSet,
  deleteDraftSet,
  discardDraftSession,
  finalizeSession,
  type DraftSession,
  type SessionSetDraft,
} from '@/lib/db/queries/sessions';
import { getRoutineWithSets, type RoutineFull } from '@/lib/db/queries/routines';
import { getPRsForExercises, type PRSnapshot } from '@/lib/db/queries/prs';
import { type RestTimerState, reduce as reduceRest } from '@/lib/workouts/rest-timer';

export type SessionPhase = 'idle' | 'hydrating' | 'active' | 'finalizing';
export type SessionMode = 'strength' | 'cardio';

export interface ExerciseInSession {
  exerciseId: string;
  position: number;
  prescribedSets: Array<{
    reps: number | null;
    weightKg: number | null;
    durationSeconds: number | null;
    distanceKm: number | null;
  }>;
  meta: {
    name: string;
    equipment: string;
    muscle: string;
    sfSymbol: string;
    kind: 'strength' | 'cardio';
  };
}

interface CompleteSetPayload {
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
}

export interface ActiveSessionState {
  phase: SessionPhase;
  mode: SessionMode;
  sessionId: number | null;
  routineId: number | null;
  routineNameSnapshot: string;
  restDefaultSeconds: number;
  startedAt: number;
  exercises: ExerciseInSession[];
  currentExerciseIdx: number;
  prSnapshot: PRSnapshot;
  setDrafts: SessionSetDraft[];
  rest: RestTimerState;

  startSession(routineId: number): Promise<void>;
  hydrateFromDraft(draft: DraftSession): Promise<void>;
  finishSession(): Promise<void>;
  discardSession(): Promise<void>;

  completeSet(exPos: number, setPos: number, payload: CompleteSetPayload): Promise<void>;
  editSet(exPos: number, setPos: number, payload: CompleteSetPayload): Promise<void>;
  removeSet(exPos: number, setPos: number): Promise<void>;
  addSetToCurrent(): Promise<void>;
  skipExercise(): void;
  goToNextExercise(): void;

  startRestTimer(durationMs: number): void;
  addRestTime(secs: number): void;
  skipRest(): void;
  tickRest(now: number): void;
}

const ZERO_STATE = {
  phase: 'idle' as const,
  mode: 'strength' as const,
  sessionId: null,
  routineId: null,
  routineNameSnapshot: '',
  restDefaultSeconds: 120,
  startedAt: 0,
  exercises: [] as ExerciseInSession[],
  currentExerciseIdx: 0,
  prSnapshot: new Map() as PRSnapshot,
  setDrafts: [] as SessionSetDraft[],
  rest: { status: 'idle' as const } as RestTimerState,
};

function exercisesFromRoutine(r: RoutineFull): ExerciseInSession[] {
  return r.exercises.map((re) => ({
    exerciseId: re.exercise.id,
    position: re.position,
    prescribedSets: re.sets.map((s) => ({
      reps: s.targetReps,
      weightKg: s.targetWeightKg,
      durationSeconds: s.targetDurationSeconds,
      distanceKm: s.targetDistanceKm,
    })),
    meta: {
      name: re.exercise.name,
      equipment: re.exercise.equipment,
      muscle: re.exercise.muscle,
      sfSymbol: re.exercise.sfSymbol,
      kind: re.exercise.kind === 'cardio' ? 'cardio' : 'strength',
    },
  }));
}

export const useActiveSessionStore = create<ActiveSessionState>()((set, get) => ({
  ...ZERO_STATE,

  startSession: async (routineId: number) => {
    set({ phase: 'hydrating' });
    const routine = await getRoutineWithSets(db, routineId);
    if (!routine) {
      set({ ...ZERO_STATE });
      throw new Error(`Routine ${routineId} not found`);
    }
    const exercises = exercisesFromRoutine(routine);
    const mode: SessionMode = exercises[0]?.meta.kind === 'cardio' ? 'cardio' : 'strength';
    const startedAt = Date.now();
    const { sessionId } = await startDraftSession(db, {
      routineId: routine.id,
      routineNameSnapshot: routine.name,
      startedAt,
    });
    const exerciseIds = exercises.map((e) => e.exerciseId);
    const snapshot = await getPRsForExercises(db, exerciseIds);
    set({
      ...ZERO_STATE,
      phase: 'active',
      mode,
      sessionId,
      routineId: routine.id,
      routineNameSnapshot: routine.name,
      restDefaultSeconds: routine.restDefaultSeconds,
      startedAt,
      exercises,
      currentExerciseIdx: 0,
      prSnapshot: snapshot,
      setDrafts: [],
      rest: { status: 'idle' },
    });
  },

  hydrateFromDraft: async (draft: DraftSession) => {
    set({ phase: 'hydrating' });
    if (draft.routineId === null) {
      // Freestyle drafts aren't supported in v2 (locked: routines are the unit). Discard defensively.
      await discardDraftSession(db, draft.id);
      set({ ...ZERO_STATE });
      return;
    }
    const routine = await getRoutineWithSets(db, draft.routineId);
    if (!routine) {
      // Routine deleted out from under us; discard the orphan draft.
      await discardDraftSession(db, draft.id);
      set({ ...ZERO_STATE });
      return;
    }
    const exercises = exercisesFromRoutine(routine);
    const mode: SessionMode = exercises[0]?.meta.kind === 'cardio' ? 'cardio' : 'strength';
    const exerciseIds = exercises.map((e) => e.exerciseId);
    const snapshot = await getPRsForExercises(db, exerciseIds);

    const setsByExPos = new Map<number, number>();
    for (const s of draft.sets) {
      setsByExPos.set(s.exercisePosition, (setsByExPos.get(s.exercisePosition) ?? 0) + 1);
    }
    let currentExerciseIdx = 0;
    for (let i = 0; i < exercises.length; i++) {
      const logged = setsByExPos.get(i) ?? 0;
      const prescribed = exercises[i].prescribedSets.length;
      if (logged < prescribed) {
        currentExerciseIdx = i;
        break;
      }
      currentExerciseIdx = Math.min(i + 1, exercises.length - 1);
    }

    set({
      ...ZERO_STATE,
      phase: 'active',
      mode,
      sessionId: draft.id,
      routineId: routine.id,
      routineNameSnapshot: routine.name,
      restDefaultSeconds: routine.restDefaultSeconds,
      startedAt: draft.startedAt,
      exercises,
      currentExerciseIdx,
      prSnapshot: snapshot,
      setDrafts: draft.sets,
      rest: { status: 'idle' },
    });
  },

  finishSession: async () => {
    const s = get();
    if (s.phase !== 'active' || s.sessionId === null) return;
    set({ phase: 'finalizing' });
    try {
      const result = await finalizeSession(db, s.sessionId, Date.now());
      set({ ...ZERO_STATE });
      router.replace({ pathname: '/(tabs)/move/post', params: { sessionId: String(result.sessionId) } });
    } catch (e) {
      set({ phase: 'active' });
      throw e;
    }
  },

  discardSession: async () => {
    const s = get();
    if (s.sessionId === null) return;
    await discardDraftSession(db, s.sessionId);
    set({ ...ZERO_STATE });
    router.replace('/(tabs)/move');
  },

  completeSet: async (exPos, setPos, payload) => {
    const s = get();
    if (s.phase !== 'active' || s.sessionId === null) return;
    const draft: SessionSetDraft = {
      exerciseId: s.exercises[exPos].exerciseId,
      exercisePosition: exPos,
      setPosition: setPos,
      reps: payload.reps,
      weightKg: payload.weightKg,
      durationSeconds: payload.durationSeconds,
      distanceKm: payload.distanceKm,
    };
    const next = [...s.setDrafts.filter((d) => !(d.exercisePosition === exPos && d.setPosition === setPos)), draft]
      .sort((a, b) => a.exercisePosition - b.exercisePosition || a.setPosition - b.setPosition);

    let nextExerciseIdx = s.currentExerciseIdx;
    if (s.mode === 'strength' && exPos === s.currentExerciseIdx) {
      const loggedAtCurrent = next.filter((d) => d.exercisePosition === exPos).length;
      const prescribed = s.exercises[exPos].prescribedSets.length;
      if (loggedAtCurrent >= prescribed && exPos + 1 < s.exercises.length) {
        nextExerciseIdx = exPos + 1;
      }
    }

    set({ setDrafts: next, currentExerciseIdx: nextExerciseIdx });

    try {
      await upsertDraftSet(db, s.sessionId, draft);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('upsertDraftSet failed (set kept locally):', e);
    }

    if (s.mode === 'strength') {
      get().startRestTimer(s.restDefaultSeconds * 1000);
    }
  },

  editSet: async (exPos, setPos, payload) => {
    return get().completeSet(exPos, setPos, payload);
  },

  removeSet: async (exPos, setPos) => {
    const s = get();
    if (s.sessionId === null) return;
    const next = s.setDrafts.filter((d) => !(d.exercisePosition === exPos && d.setPosition === setPos));
    set({ setDrafts: next });
    try {
      await deleteDraftSet(db, s.sessionId, exPos, setPos);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('deleteDraftSet failed:', e);
    }
  },

  addSetToCurrent: async () => {
    const s = get();
    if (s.phase !== 'active' || s.sessionId === null) return;
    const exPos = s.currentExerciseIdx;
    const ex = s.exercises[exPos];
    if (!ex) return;
    const loggedAt = s.setDrafts.filter((d) => d.exercisePosition === exPos);
    const lastLogged = loggedAt[loggedAt.length - 1];
    const lastPrescribed = ex.prescribedSets[ex.prescribedSets.length - 1];
    const prescribed = {
      reps: lastLogged?.reps ?? lastPrescribed?.reps ?? null,
      weightKg: lastLogged?.weightKg ?? lastPrescribed?.weightKg ?? null,
      durationSeconds: lastPrescribed?.durationSeconds ?? null,
      distanceKm: lastPrescribed?.distanceKm ?? null,
    };
    const newPrescribed = [...ex.prescribedSets, prescribed];
    const newExercises = s.exercises.map((e, i) => i === exPos ? { ...e, prescribedSets: newPrescribed } : e);
    set({ exercises: newExercises });
  },

  skipExercise: () => {
    const s = get();
    if (s.phase !== 'active') return;
    if (s.currentExerciseIdx + 1 >= s.exercises.length) return;
    set({ currentExerciseIdx: s.currentExerciseIdx + 1 });
  },

  goToNextExercise: () => {
    const s = get();
    if (s.phase !== 'active') return;
    if (s.currentExerciseIdx + 1 >= s.exercises.length) return;
    set({ currentExerciseIdx: s.currentExerciseIdx + 1 });
  },

  startRestTimer: () => { throw new Error('startRestTimer: not yet implemented'); },
  addRestTime: () => { throw new Error('addRestTime: not yet implemented'); },
  skipRest: () => { throw new Error('skipRest: not yet implemented'); },
  tickRest: () => { throw new Error('tickRest: not yet implemented'); },
}));
