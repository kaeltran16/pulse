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
