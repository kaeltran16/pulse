import { sql } from 'drizzle-orm';
import { type AnyDb } from './onboarding';
import { routines, routineExercises, routineSets } from '../schema';
import type { GeneratedRoutine } from '../../pal/types';

function isCardio(g: GeneratedRoutine): g is Extract<GeneratedRoutine, { tag: 'Cardio' }> {
  return g.tag === 'Cardio';
}

export async function saveGeneratedRoutine(db: AnyDb, generated: GeneratedRoutine): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db as any).transaction((tx: AnyDb) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maxRow: Array<{ max: number | null }> = (tx as any)
      .select({ max: sql<number | null>`MAX(${routines.position})` })
      .from(routines)
      .all();
    const nextPos = (maxRow[0]?.max ?? -1) + 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted = (tx as any)
      .insert(routines)
      .values({
        name: generated.name,
        tag: generated.tag,
        color: 'accent',
        position: nextPos,
        restDefaultSeconds: 120,
        warmupReminder: false,
        autoProgress: false,
      })
      .returning({ id: routines.id })
      .get();
    const routineId: number = inserted.id;

    for (let exIdx = 0; exIdx < generated.exercises.length; exIdx++) {
      const ex = generated.exercises[exIdx];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reInserted = (tx as any)
        .insert(routineExercises)
        .values({
          routineId,
          exerciseId: ex.id,
          position: exIdx,
          restSeconds: null,
        })
        .returning({ id: routineExercises.id })
        .get();
      const reId: number = reInserted.id;

      for (let setIdx = 0; setIdx < ex.sets.length; setIdx++) {
        const s = ex.sets[setIdx];
        if (isCardio(generated)) {
          const cs = s as { duration?: number; distance?: number; pace?: string };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tx as any).insert(routineSets).values({
            routineExerciseId: reId,
            position: setIdx,
            targetReps: null,
            targetWeightKg: null,
            targetDurationSeconds: cs.duration !== undefined ? Math.round(cs.duration * 60) : null,
            targetDistanceKm: cs.distance ?? null,
          }).run();
        } else {
          const ss = s as { reps: number; weight: number };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tx as any).insert(routineSets).values({
            routineExerciseId: reId,
            position: setIdx,
            targetReps: ss.reps,
            targetWeightKg: ss.weight,
            targetDurationSeconds: null,
            targetDistanceKm: null,
          }).run();
        }
      }
    }
    return routineId;
  });
}
