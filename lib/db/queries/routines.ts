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
  restDefaultSeconds: number;
  warmupReminder: boolean;
  autoProgress: boolean;
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
        SELECT MAX(${sessions.finishedAt}) FROM ${sessions}
        WHERE ${sessions.routineId} = ${routines.id} AND ${sessions.status} = 'completed'
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
    restDefaultSeconds: head.restDefaultSeconds,
    warmupReminder: Boolean(head.warmupReminder),
    autoProgress: Boolean(head.autoProgress),
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

export async function createEmptyRoutine(
  db: AnyDb,
  init: { name: string; tag: string; color?: string },
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxRow: Array<{ max: number | null }> = await (db as any)
    .select({ max: sql<number | null>`MAX(${routines.position})` })
    .from(routines);
  const nextPos = (maxRow[0]?.max ?? -1) + 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inserted = (db as any)
    .insert(routines)
    .values({
      name: init.name,
      tag: init.tag,
      color: init.color ?? 'accent',
      position: nextPos,
      restDefaultSeconds: 120,
      warmupReminder: false,
      autoProgress: false,
    })
    .returning({ id: routines.id })
    .get();
  return inserted.id as number;
}

export async function deleteRoutine(db: AnyDb, id: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).delete(routines).where(eq(routines.id, id)).run();
}

function nextCopyName(existingNames: string[], baseName: string): string {
  const m = baseName.match(/^(.*) copy(?: (\d+))?$/);
  const root = m ? m[1] : baseName;
  const taken = new Set(existingNames);
  if (!taken.has(`${root} copy`)) return `${root} copy`;
  for (let n = 2; n < 10000; n++) {
    const cand = `${root} copy ${n}`;
    if (!taken.has(cand)) return cand;
  }
  throw new Error('Too many copies');
}

export async function duplicateRoutine(db: AnyDb, sourceId: number): Promise<number> {
  const src = await getRoutineWithSets(db, sourceId);
  if (!src) throw new Error(`Routine ${sourceId} not found`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allNames: Array<{ name: string }> = await (db as any).select({ name: routines.name }).from(routines);
  const newName = nextCopyName(allNames.map((r) => r.name), src.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxRow: Array<{ max: number | null }> = await (db as any)
    .select({ max: sql<number | null>`MAX(${routines.position})` })
    .from(routines);
  const nextPos = (maxRow[0]?.max ?? -1) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inserted = (db as any).insert(routines).values({
    name: newName,
    tag: src.tag,
    color: src.color,
    position: nextPos,
    restDefaultSeconds: src.restDefaultSeconds,
    warmupReminder: src.warmupReminder,
    autoProgress: src.autoProgress,
  }).returning({ id: routines.id }).get();
  const newRoutineId = inserted.id as number;

  for (const ex of src.exercises) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertedRe = (db as any).insert(routineExercises).values({
      routineId: newRoutineId,
      exerciseId: ex.exercise.id,
      position: ex.position,
      restSeconds: ex.restSeconds,
    }).returning({ id: routineExercises.id }).get();
    const newReId = insertedRe.id as number;
    for (const s of ex.sets) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db as any).insert(routineSets).values({
        routineExerciseId: newReId,
        position: s.position,
        targetReps: s.targetReps,
        targetWeightKg: s.targetWeightKg,
        targetDurationSeconds: s.targetDurationSeconds,
        targetDistanceKm: s.targetDistanceKm,
      }).run();
    }
  }
  return newRoutineId;
}

export interface DraftSetInput {
  id: number | null;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetDurationSeconds: number | null;
  targetDistanceKm: number | null;
}
export interface DraftExerciseInput {
  id: number | null;
  exerciseId: string;
  restSeconds: number | null;
  sets: DraftSetInput[];
}
export interface DraftInput {
  routineId: number;
  name: string;
  tag: string;
  color: string;
  position: number;
  restDefaultSeconds: number;
  warmupReminder: boolean;
  autoProgress: boolean;
  exercises: DraftExerciseInput[];
}

export async function updateRoutine(db: AnyDb, draft: DraftInput): Promise<void> {
  // better-sqlite3 transactions are synchronous; expo-sqlite drizzle accepts the same.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).transaction((tx: AnyDb) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tx as any).update(routines).set({
      name: draft.name,
      tag: draft.tag,
      color: draft.color,
      position: draft.position,
      restDefaultSeconds: draft.restDefaultSeconds,
      warmupReminder: draft.warmupReminder,
      autoProgress: draft.autoProgress,
    }).where(eq(routines.id, draft.routineId)).run();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const persistedRe: Array<{ id: number }> = (tx as any)
      .select({ id: routineExercises.id })
      .from(routineExercises)
      .where(eq(routineExercises.routineId, draft.routineId))
      .all();
    const draftReIds = new Set(draft.exercises.map((e) => e.id).filter((x): x is number => x !== null));
    for (const row of persistedRe) {
      if (!draftReIds.has(row.id)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tx as any).delete(routineExercises).where(eq(routineExercises.id, row.id)).run();
      }
    }

    for (let i = 0; i < draft.exercises.length; i++) {
      const ex = draft.exercises[i];
      let reId: number;
      if (ex.id === null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inserted = (tx as any).insert(routineExercises).values({
          routineId: draft.routineId,
          exerciseId: ex.exerciseId,
          position: i,
          restSeconds: ex.restSeconds,
        }).returning({ id: routineExercises.id }).get();
        reId = inserted.id as number;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tx as any).update(routineExercises).set({
          exerciseId: ex.exerciseId,
          position: i,
          restSeconds: ex.restSeconds,
        }).where(eq(routineExercises.id, ex.id)).run();
        reId = ex.id;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const persistedSets: Array<{ id: number }> = (tx as any)
        .select({ id: routineSets.id })
        .from(routineSets)
        .where(eq(routineSets.routineExerciseId, reId))
        .all();
      const draftSetIds = new Set(ex.sets.map((s) => s.id).filter((x): x is number => x !== null));
      for (const row of persistedSets) {
        if (!draftSetIds.has(row.id)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tx as any).delete(routineSets).where(eq(routineSets.id, row.id)).run();
        }
      }
      for (let j = 0; j < ex.sets.length; j++) {
        const s = ex.sets[j];
        if (s.id === null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tx as any).insert(routineSets).values({
            routineExerciseId: reId,
            position: j,
            targetReps: s.targetReps,
            targetWeightKg: s.targetWeightKg,
            targetDurationSeconds: s.targetDurationSeconds,
            targetDistanceKm: s.targetDistanceKm,
          }).run();
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tx as any).update(routineSets).set({
            position: j,
            targetReps: s.targetReps,
            targetWeightKg: s.targetWeightKg,
            targetDurationSeconds: s.targetDurationSeconds,
            targetDistanceKm: s.targetDistanceKm,
          }).where(eq(routineSets.id, s.id)).run();
        }
      }
    }
  });
}
