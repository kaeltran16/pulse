import { create } from 'zustand';

import type { RoutineFull } from '@/lib/db/queries/routines';

export interface DraftSet {
  id: number | null;
  position: number;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetDurationSeconds: number | null;
  targetDistanceKm: number | null;
}

export interface DraftExercise {
  id: number | null;
  exerciseId: string;
  position: number;
  restSeconds: number | null;
  sets: DraftSet[];
}

export interface Draft {
  routineId: number;
  name: string;
  tag: string;
  color: string;
  position: number;
  restDefaultSeconds: number;
  warmupReminder: boolean;
  autoProgress: boolean;
  exercises: DraftExercise[];
}

export interface EditorState {
  draft: Draft | null;
  isDirty: boolean;
  loadDraft: (r: RoutineFull) => void;
  clearDraft: () => void;
  setName: (n: string) => void;
  setTag: (t: string) => void;
  setRestDefault: (s: number) => void;
  setWarmupReminder: (b: boolean) => void;
  setAutoProgress: (b: boolean) => void;
  addExercise: (exerciseId: string) => void;
  removeExercise: (index: number) => void;
  reorderExercises: (from: number, to: number) => void;
  setExerciseRest: (index: number, restSeconds: number | null) => void;
  addSet: (exerciseIndex: number) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  updateSet: (exerciseIndex: number, setIndex: number, patch: Partial<Omit<DraftSet, 'id' | 'position'>>) => void;
  reorderSets: (exerciseIndex: number, from: number, to: number) => void;
}

function fromRoutineFull(r: RoutineFull): Draft {
  return {
    routineId: r.id,
    name: r.name,
    tag: r.tag,
    color: r.color,
    position: r.position,
    restDefaultSeconds: r.restDefaultSeconds,
    warmupReminder: r.warmupReminder,
    autoProgress: r.autoProgress,
    exercises: r.exercises.map((ex) => ({
      id: ex.id,
      exerciseId: ex.exercise.id,
      position: ex.position,
      restSeconds: ex.restSeconds,
      sets: ex.sets.map((s) => ({
        id: s.id,
        position: s.position,
        targetReps: s.targetReps,
        targetWeightKg: s.targetWeightKg,
        targetDurationSeconds: s.targetDurationSeconds,
        targetDistanceKm: s.targetDistanceKm,
      })),
    })),
  };
}

function dirty<T extends EditorState>(set: (fn: (s: T) => Partial<T>) => void) {
  return (mut: (d: Draft) => void) =>
    set((s) => {
      if (!s.draft) return {} as Partial<T>;
      const next = structuredClone(s.draft);
      mut(next);
      return { draft: next, isDirty: true } as Partial<T>;
    });
}

export const useEditorStore = create<EditorState>()((set) => {
  const mutate = dirty<EditorState>(set);
  return {
    draft: null,
    isDirty: false,
    loadDraft: (r) => set({ draft: fromRoutineFull(r), isDirty: false }),
    clearDraft: () => set({ draft: null, isDirty: false }),
    setName: (n) => mutate((d) => { d.name = n; }),
    setTag: (t) => mutate((d) => { d.tag = t; }),
    setRestDefault: (s) => mutate((d) => { d.restDefaultSeconds = s; }),
    setWarmupReminder: (b) => mutate((d) => { d.warmupReminder = b; }),
    setAutoProgress: (b) => mutate((d) => { d.autoProgress = b; }),
    addExercise: (exerciseId) => mutate((d) => {
      d.exercises.push({
        id: null,
        exerciseId,
        position: d.exercises.length,
        restSeconds: null,
        sets: [
          { id: null, position: 0, targetReps: 8, targetWeightKg: null, targetDurationSeconds: null, targetDistanceKm: null },
          { id: null, position: 1, targetReps: 8, targetWeightKg: null, targetDurationSeconds: null, targetDistanceKm: null },
          { id: null, position: 2, targetReps: 8, targetWeightKg: null, targetDurationSeconds: null, targetDistanceKm: null },
        ],
      });
    }),
    removeExercise: (index) => mutate((d) => {
      d.exercises.splice(index, 1);
      d.exercises.forEach((ex, i) => { ex.position = i; });
    }),
    reorderExercises: (from, to) => mutate((d) => {
      if (from === to || from < 0 || to < 0 || from >= d.exercises.length || to >= d.exercises.length) return;
      const [moved] = d.exercises.splice(from, 1);
      d.exercises.splice(to, 0, moved);
      d.exercises.forEach((ex, i) => { ex.position = i; });
    }),
    setExerciseRest: (index, restSeconds) => mutate((d) => {
      if (d.exercises[index]) d.exercises[index].restSeconds = restSeconds;
    }),
    addSet: (exerciseIndex) => mutate((d) => {
      const ex = d.exercises[exerciseIndex];
      if (!ex) return;
      const last = ex.sets[ex.sets.length - 1];
      ex.sets.push({
        id: null,
        position: ex.sets.length,
        targetReps: last?.targetReps ?? 8,
        targetWeightKg: last?.targetWeightKg ?? null,
        targetDurationSeconds: last?.targetDurationSeconds ?? null,
        targetDistanceKm: last?.targetDistanceKm ?? null,
      });
    }),
    removeSet: (exerciseIndex, setIndex) => mutate((d) => {
      const ex = d.exercises[exerciseIndex];
      if (!ex) return;
      ex.sets.splice(setIndex, 1);
      ex.sets.forEach((s, i) => { s.position = i; });
    }),
    updateSet: (exerciseIndex, setIndex, patch) => mutate((d) => {
      const s = d.exercises[exerciseIndex]?.sets[setIndex];
      if (!s) return;
      Object.assign(s, patch);
    }),
    reorderSets: (exerciseIndex, from, to) => mutate((d) => {
      const ex = d.exercises[exerciseIndex];
      if (!ex) return;
      if (from === to || from < 0 || to < 0 || from >= ex.sets.length || to >= ex.sets.length) return;
      const [moved] = ex.sets.splice(from, 1);
      ex.sets.splice(to, 0, moved);
      ex.sets.forEach((s, i) => { s.position = i; });
    }),
  };
});
