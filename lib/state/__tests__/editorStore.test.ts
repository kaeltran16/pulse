/** @jest-environment node */
import { useEditorStore } from '../editorStore';
import type { RoutineFull } from '@/lib/db/queries/routines';

const fakeFull: RoutineFull = {
  id: 1, name: 'Push', tag: 'Upper', color: 'move', position: 0,
  restDefaultSeconds: 120, warmupReminder: false, autoProgress: false,
  exercises: [
    {
      id: 10, position: 0, restSeconds: null,
      exercise: { id: 'bench', name: 'Bench', group: 'Push', muscle: 'Chest', equipment: 'Barbell', kind: 'strength', sfSymbol: 'x' },
      sets: [
        { id: 100, routineExerciseId: 10, position: 0, targetReps: 5, targetWeightKg: 60, targetDurationSeconds: null, targetDistanceKm: null },
      ],
    },
  ],
};

beforeEach(() => useEditorStore.getState().clearDraft());

describe('editorStore', () => {
  it('starts with no draft and isDirty=false', () => {
    expect(useEditorStore.getState().draft).toBeNull();
    expect(useEditorStore.getState().isDirty).toBe(false);
  });

  it('loadDraft hydrates draft and resets isDirty', () => {
    useEditorStore.getState().loadDraft(fakeFull);
    const s = useEditorStore.getState();
    expect(s.draft).not.toBeNull();
    expect(s.draft!.name).toBe('Push');
    expect(s.draft!.exercises[0].sets[0].targetReps).toBe(5);
    expect(s.isDirty).toBe(false);
  });

  it('clearDraft empties draft and resets isDirty', () => {
    useEditorStore.getState().loadDraft(fakeFull);
    useEditorStore.getState().clearDraft();
    const s = useEditorStore.getState();
    expect(s.draft).toBeNull();
    expect(s.isDirty).toBe(false);
  });
});

describe('editorStore top-level mutators', () => {
  beforeEach(() => {
    useEditorStore.getState().clearDraft();
    useEditorStore.getState().loadDraft(fakeFull);
  });

  it('setName flips isDirty and updates value', () => {
    useEditorStore.getState().setName('Renamed');
    expect(useEditorStore.getState().draft!.name).toBe('Renamed');
    expect(useEditorStore.getState().isDirty).toBe(true);
  });

  it('setTag, setRestDefault, setWarmupReminder, setAutoProgress all set isDirty', () => {
    useEditorStore.getState().setTag('Lower');
    useEditorStore.getState().setRestDefault(60);
    useEditorStore.getState().setWarmupReminder(true);
    useEditorStore.getState().setAutoProgress(true);
    const d = useEditorStore.getState().draft!;
    expect(d.tag).toBe('Lower');
    expect(d.restDefaultSeconds).toBe(60);
    expect(d.warmupReminder).toBe(true);
    expect(d.autoProgress).toBe(true);
    expect(useEditorStore.getState().isDirty).toBe(true);
  });

  it('mutators on null draft are no-ops', () => {
    useEditorStore.getState().clearDraft();
    useEditorStore.getState().setName('X');
    expect(useEditorStore.getState().draft).toBeNull();
    expect(useEditorStore.getState().isDirty).toBe(false);
  });
});

describe('editorStore exercise mutators', () => {
  beforeEach(() => {
    useEditorStore.getState().clearDraft();
    useEditorStore.getState().loadDraft(fakeFull);
  });

  it('addExercise appends with id=null and 3 default sets', () => {
    useEditorStore.getState().addExercise('ohp');
    const ex = useEditorStore.getState().draft!.exercises;
    expect(ex).toHaveLength(2);
    expect(ex[1].id).toBeNull();
    expect(ex[1].exerciseId).toBe('ohp');
    expect(ex[1].position).toBe(1);
    expect(ex[1].sets).toHaveLength(3);
    expect(useEditorStore.getState().isDirty).toBe(true);
  });

  it('removeExercise renumbers positions densely', () => {
    useEditorStore.getState().addExercise('ohp');
    useEditorStore.getState().addExercise('incline-db');
    useEditorStore.getState().removeExercise(0);
    const ex = useEditorStore.getState().draft!.exercises;
    expect(ex.map((e) => e.position)).toEqual([0, 1]);
  });

  it('reorderExercises moves and renumbers; no-op for invalid args', () => {
    useEditorStore.getState().addExercise('ohp');
    useEditorStore.getState().addExercise('incline-db');
    useEditorStore.getState().reorderExercises(0, 2);
    let ex = useEditorStore.getState().draft!.exercises;
    expect(ex.map((e) => e.exerciseId)).toEqual(['ohp', 'incline-db', 'bench']);
    expect(ex.map((e) => e.position)).toEqual([0, 1, 2]);
    useEditorStore.getState().reorderExercises(0, 0);
    useEditorStore.getState().reorderExercises(-1, 1);
    useEditorStore.getState().reorderExercises(0, 99);
    ex = useEditorStore.getState().draft!.exercises;
    expect(ex.map((e) => e.exerciseId)).toEqual(['ohp', 'incline-db', 'bench']);
  });

  it('setExerciseRest accepts number and null', () => {
    useEditorStore.getState().setExerciseRest(0, 90);
    expect(useEditorStore.getState().draft!.exercises[0].restSeconds).toBe(90);
    useEditorStore.getState().setExerciseRest(0, null);
    expect(useEditorStore.getState().draft!.exercises[0].restSeconds).toBeNull();
  });
});

describe('editorStore set mutators', () => {
  beforeEach(() => {
    useEditorStore.getState().clearDraft();
    useEditorStore.getState().loadDraft(fakeFull);
  });

  it('addSet appends with id=null, copies last set targets', () => {
    useEditorStore.getState().addSet(0);
    const sets = useEditorStore.getState().draft!.exercises[0].sets;
    expect(sets).toHaveLength(2);
    expect(sets[1].id).toBeNull();
    expect(sets[1].position).toBe(1);
    expect(sets[1].targetReps).toBe(5);
    expect(sets[1].targetWeightKg).toBe(60);
  });

  it('removeSet renumbers densely', () => {
    useEditorStore.getState().addSet(0);
    useEditorStore.getState().addSet(0);
    useEditorStore.getState().removeSet(0, 1);
    const sets = useEditorStore.getState().draft!.exercises[0].sets;
    expect(sets.map((s) => s.position)).toEqual([0, 1]);
  });

  it('updateSet patches reps and weight without touching id', () => {
    useEditorStore.getState().updateSet(0, 0, { targetReps: 12, targetWeightKg: 65 });
    const s = useEditorStore.getState().draft!.exercises[0].sets[0];
    expect(s.id).toBe(100);
    expect(s.targetReps).toBe(12);
    expect(s.targetWeightKg).toBe(65);
  });

  it('reorderSets moves and renumbers; no-op for invalid args', () => {
    useEditorStore.getState().addSet(0);
    useEditorStore.getState().addSet(0);
    useEditorStore.getState().reorderSets(0, 2, 0);
    const sets = useEditorStore.getState().draft!.exercises[0].sets;
    expect(sets.map((s) => s.position)).toEqual([0, 1, 2]);
    useEditorStore.getState().reorderSets(0, 0, 0);
    useEditorStore.getState().reorderSets(0, -1, 1);
    useEditorStore.getState().reorderSets(0, 0, 99);
  });
});
