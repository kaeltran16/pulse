import { asc, eq, sql } from 'drizzle-orm';

import { exercises, routines, routineExercises, routineSets, sessions } from '../schema';
import { type AnyDb } from './onboarding';

export interface RoutineSummary {
  id: number;
  name: string;
  tag: string;
  color: string;
  position: number;
  exerciseCount: number;
  estMinutes: number;
  lastDoneAt: number | null;
}

export interface RoutineFull {
  id: number;
  name: string;
  tag: string;
  color: string;
  position: number;
  exercises: Array<{
    id: number;
    position: number;
    restSeconds: number | null;
    exercise: typeof exercises.$inferSelect;
    sets: (typeof routineSets.$inferSelect)[];
  }>;
}

function estimateMinutesForRow(args: {
  setCount: number;
  restSecondsTotal: number;
  cardioDurationSecondsTotal: number;
}): number {
  const strengthMin = args.setCount + args.restSecondsTotal / 60;
  const cardioMin = args.cardioDurationSecondsTotal / 60;
  return Math.max(1, Math.round(strengthMin + cardioMin));
}

export async function listRoutines(db: AnyDb): Promise<RoutineSummary[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (db as any)
    .select({
      id: routines.id,
      name: routines.name,
      tag: routines.tag,
      color: routines.color,
      position: routines.position,
      exerciseCount: sql<number>`COUNT(DISTINCT ${routineExercises.id})`,
      setCount: sql<number>`COUNT(${routineSets.id})`,
      restSecondsTotal: sql<number>`COALESCE(SUM(${routineExercises.restSeconds}), 0)`,
      cardioDurationSecondsTotal: sql<number>`COALESCE(SUM(${routineSets.targetDurationSeconds}), 0)`,
      lastDoneAt: sql<number | null>`(
        SELECT MAX(${sessions.finishedAt}) FROM ${sessions} WHERE ${sessions.routineId} = ${routines.id}
      )`,
    })
    .from(routines)
    .leftJoin(routineExercises, eq(routineExercises.routineId, routines.id))
    .leftJoin(routineSets, eq(routineSets.routineExerciseId, routineExercises.id))
    .groupBy(routines.id)
    .orderBy(asc(routines.position));

  return rows.map((r: {
    id: number; name: string; tag: string; color: string; position: number;
    exerciseCount: number; setCount: number; restSecondsTotal: number;
    cardioDurationSecondsTotal: number; lastDoneAt: number | null;
  }) => ({
    id: r.id, name: r.name, tag: r.tag, color: r.color, position: r.position,
    exerciseCount: r.exerciseCount,
    estMinutes: estimateMinutesForRow({
      setCount: r.setCount,
      restSecondsTotal: r.restSecondsTotal,
      cardioDurationSecondsTotal: r.cardioDurationSecondsTotal,
    }),
    lastDoneAt: r.lastDoneAt,
  }));
}

export async function getRoutineWithSets(db: AnyDb, routineId: number): Promise<RoutineFull | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = await (db as any).select().from(routines).where(eq(routines.id, routineId));
  if (r.length === 0) return null;
  const head = r[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reRows = await (db as any)
    .select()
    .from(routineExercises)
    .leftJoin(exercises, eq(exercises.id, routineExercises.exerciseId))
    .where(eq(routineExercises.routineId, routineId))
    .orderBy(asc(routineExercises.position));

  const reIds = reRows.map((row: { routine_exercises: { id: number } }) => row.routine_exercises.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setRows = await (db as any)
    .select()
    .from(routineSets)
    .orderBy(asc(routineSets.routineExerciseId), asc(routineSets.position));

  const setsByRe = new Map<number, (typeof routineSets.$inferSelect)[]>();
  for (const s of setRows as (typeof routineSets.$inferSelect)[]) {
    const list = setsByRe.get(s.routineExerciseId) ?? [];
    list.push(s);
    setsByRe.set(s.routineExerciseId, list);
  }

  return {
    id: head.id,
    name: head.name,
    tag: head.tag,
    color: head.color,
    position: head.position,
    exercises: reRows
      .filter((row: { routine_exercises: { id: number } }) => reIds.includes(row.routine_exercises.id))
      .map((row: {
        routine_exercises: { id: number; position: number; restSeconds: number | null };
        exercises: typeof exercises.$inferSelect;
      }) => ({
        id: row.routine_exercises.id,
        position: row.routine_exercises.position,
        restSeconds: row.routine_exercises.restSeconds,
        exercise: row.exercises,
        sets: setsByRe.get(row.routine_exercises.id) ?? [],
      })),
  };
}
