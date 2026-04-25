import { Alert } from 'react-native';
import { db } from '@/lib/db/client';
import { deleteRoutine, duplicateRoutine, updateRoutine, getRoutineWithSets } from '@/lib/db/queries/routines';

export function useRoutineActions() {
  return {
    duplicate: async (id: number) => {
      try {
        await duplicateRoutine(db, id);
      } catch (e) {
        Alert.alert("Couldn't duplicate routine", String(e));
      }
    },
    rename: async (id: number, newName: string) => {
      try {
        const r = await getRoutineWithSets(db, id);
        if (!r) return;
        await updateRoutine(db, {
          routineId: r.id, name: newName, tag: r.tag, color: r.color, position: r.position,
          restDefaultSeconds: r.restDefaultSeconds, warmupReminder: r.warmupReminder, autoProgress: r.autoProgress,
          exercises: r.exercises.map((ex) => ({
            id: ex.id, exerciseId: ex.exercise.id, restSeconds: ex.restSeconds,
            sets: ex.sets.map((s) => ({
              id: s.id,
              targetReps: s.targetReps, targetWeightKg: s.targetWeightKg,
              targetDurationSeconds: s.targetDurationSeconds, targetDistanceKm: s.targetDistanceKm,
            })),
          })),
        });
      } catch (e) {
        Alert.alert("Couldn't rename routine", String(e));
      }
    },
    delete: (id: number, name: string) =>
      new Promise<boolean>((resolve) => {
        Alert.alert(
          'Delete routine',
          `Delete "${name}"? This can't be undone.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                  await deleteRoutine(db, id);
                  resolve(true);
                } catch (e) {
                  Alert.alert("Couldn't delete routine", String(e));
                  resolve(false);
                }
              },
            },
          ],
        );
      }),
  };
}
