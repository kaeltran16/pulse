import { and, asc, desc, eq } from 'drizzle-orm';

import { detectSessionPRs } from '../../workouts/pr-detection';
import { computeStrengthVolume } from '../../workouts/volume';
import { exercises as exercisesTable, movementEntries, prs, sessions, sessionSets } from '../schema';
import { type AnyDb } from './onboarding';

export interface CompletedSessionDraftSet {
  exerciseId: string;
  exercisePosition: number;
  setPosition: number;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
}

export interface CompletedSessionDraft {
  routineId: number | null;
  routineNameSnapshot: string;
  startedAt: number;
  finishedAt: number;
  sets: CompletedSessionDraftSet[];
}

export interface SessionSetDraft {
  exerciseId: string;
  exercisePosition: number;
  setPosition: number;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
}

export interface DraftSession {
  id: number;
  routineId: number | null;
  routineNameSnapshot: string;
  startedAt: number;
  sets: SessionSetDraft[];
}

export interface CompletedSessionResult {
  sessionId: number;
  prCount: number;
  totalVolumeKg: number;
}

export interface SessionSummary {
  id: number;
  routineId: number | null;
  routineNameSnapshot: string;
  startedAt: number;
  finishedAt: number;
  durationSeconds: number;
  totalVolumeKg: number;
  prCount: number;
}

export interface ExerciseMeta {
  name: string;
  muscle: string;
  group: string;
  equipment: string;
  kind: 'strength' | 'cardio';
  sfSymbol: string;
}

export interface SessionFull extends SessionSummary {
  sets: (typeof sessionSets.$inferSelect)[];
  mode: 'strength' | 'cardio';
  exerciseMetaById: Record<string, ExerciseMeta>;
}

export async function listSessions(
  db: AnyDb,
  args: { limit?: number; offset?: number } = {},
): Promise<SessionSummary[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (db as any)
    .select()
    .from(sessions)
    .where(eq(sessions.status, 'completed'))
    .orderBy(desc(sessions.startedAt));
  if (args.limit !== undefined)  q = q.limit(args.limit);
  if (args.offset !== undefined) q = q.offset(args.offset);
  const rows = await q;
  return rows.map((r: SessionSummary) => ({
    id: r.id,
    routineId: r.routineId,
    routineNameSnapshot: r.routineNameSnapshot,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    durationSeconds: r.durationSeconds,
    totalVolumeKg: r.totalVolumeKg,
    prCount: r.prCount,
  }));
}

export async function getSession(db: AnyDb, sessionId: number): Promise<SessionFull | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const head = await (db as any).select().from(sessions).where(eq(sessions.id, sessionId));
  if (head.length === 0) return null;
  const h: SessionSummary = head[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sets = await (db as any)
    .select()
    .from(sessionSets)
    .where(eq(sessionSets.sessionId, sessionId))
    .orderBy(asc(sessionSets.exercisePosition), asc(sessionSets.setPosition));

  const exerciseIds = Array.from(new Set(sets.map((s: { exerciseId: string }) => s.exerciseId)));
  const exerciseMetaById: Record<string, ExerciseMeta> = {};
  if (exerciseIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metaRows = await (db as any).select().from(exercisesTable);
    for (const row of metaRows as Array<typeof exercisesTable.$inferSelect>) {
      if (exerciseIds.includes(row.id)) {
        exerciseMetaById[row.id] = {
          name: row.name,
          muscle: row.muscle,
          group: row.group,
          equipment: row.equipment,
          kind: row.kind as 'strength' | 'cardio',
          sfSymbol: row.sfSymbol,
        };
      }
    }
  }

  const firstSet = sets[0] as typeof sessionSets.$inferSelect | undefined;
  const firstMeta = firstSet ? exerciseMetaById[firstSet.exerciseId] : undefined;
  const mode: 'strength' | 'cardio' = firstMeta?.kind === 'cardio' ? 'cardio' : 'strength';

  return {
    id: h.id,
    routineId: h.routineId,
    routineNameSnapshot: h.routineNameSnapshot,
    startedAt: h.startedAt,
    finishedAt: h.finishedAt,
    durationSeconds: h.durationSeconds,
    totalVolumeKg: h.totalVolumeKg,
    prCount: h.prCount,
    sets,
    mode,
    exerciseMetaById,
  };
}

export class DraftAlreadyOpenError extends Error {
  constructor() {
    super('A draft session is already open. Resume or discard it before starting a new one.');
    this.name = 'DraftAlreadyOpenError';
  }
}

export interface StartDraftSessionArgs {
  routineId: number | null;
  routineNameSnapshot: string;
  startedAt: number;
}

export async function startDraftSession(
  db: AnyDb,
  args: StartDraftSessionArgs,
): Promise<{ sessionId: number }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted = await (db as any)
      .insert(sessions)
      .values({
        routineId: args.routineId,
        routineNameSnapshot: args.routineNameSnapshot,
        status: 'draft',
        startedAt: args.startedAt,
        finishedAt: null,
        durationSeconds: 0,
        totalVolumeKg: 0,
        prCount: 0,
      })
      .returning({ id: sessions.id });
    return { sessionId: inserted[0].id };
  } catch (e) {
    const msg = String(e);
    // The only UNIQUE constraint involving sessions.status is the partial index
    // idx_sessions_one_draft (one draft at a time). better-sqlite3 surfaces the
    // violation as "UNIQUE constraint failed: sessions.status".
    if (
      msg.includes('UNIQUE') &&
      (msg.includes('idx_sessions_one_draft') || msg.includes('sessions.status'))
    ) {
      throw new DraftAlreadyOpenError();
    }
    throw e;
  }
}

export async function getOpenDraft(db: AnyDb): Promise<DraftSession | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heads = await (db as any)
    .select()
    .from(sessions)
    .where(eq(sessions.status, 'draft'));
  if (heads.length === 0) return null;
  const head = heads[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sets = await (db as any)
    .select()
    .from(sessionSets)
    .where(eq(sessionSets.sessionId, head.id))
    .orderBy(asc(sessionSets.exercisePosition), asc(sessionSets.setPosition));

  return {
    id: head.id,
    routineId: head.routineId,
    routineNameSnapshot: head.routineNameSnapshot,
    startedAt: head.startedAt,
    sets: sets.map((r: typeof sessionSets.$inferSelect) => ({
      exerciseId: r.exerciseId,
      exercisePosition: r.exercisePosition,
      setPosition: r.setPosition,
      reps: r.reps,
      weightKg: r.weightKg,
      durationSeconds: r.durationSeconds,
      distanceKm: r.distanceKm,
    })),
  };
}

export async function upsertDraftSet(
  db: AnyDb,
  sessionId: number,
  draft: SessionSetDraft,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await (db as any)
    .select({ id: sessionSets.id })
    .from(sessionSets)
    .where(
      and(
        eq(sessionSets.sessionId, sessionId),
        eq(sessionSets.exercisePosition, draft.exercisePosition),
        eq(sessionSets.setPosition, draft.setPosition),
      ),
    );
  if (existing.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .update(sessionSets)
      .set({
        exerciseId: draft.exerciseId,
        reps: draft.reps,
        weightKg: draft.weightKg,
        durationSeconds: draft.durationSeconds,
        distanceKm: draft.distanceKm,
        isPr: 0,
      })
      .where(eq(sessionSets.id, existing[0].id));
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .insert(sessionSets)
    .values({
      sessionId,
      exerciseId: draft.exerciseId,
      exercisePosition: draft.exercisePosition,
      setPosition: draft.setPosition,
      reps: draft.reps,
      weightKg: draft.weightKg,
      durationSeconds: draft.durationSeconds,
      distanceKm: draft.distanceKm,
      isPr: 0,
    });
}

export async function discardDraftSession(db: AnyDb, sessionId: number): Promise<void> {
  // session_sets has ON DELETE CASCADE on sessions.id; deleting the session row removes both.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).delete(sessions).where(eq(sessions.id, sessionId));
}

export async function deleteDraftSet(
  db: AnyDb,
  sessionId: number,
  exercisePosition: number,
  setPosition: number,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .delete(sessionSets)
    .where(
      and(
        eq(sessionSets.sessionId, sessionId),
        eq(sessionSets.exercisePosition, exercisePosition),
        eq(sessionSets.setPosition, setPosition),
      ),
    );
}

export interface SessionRowData {
  id: number;
  routineNameSnapshot: string;
  finishedAt: number;
  durationSeconds: number;
  mode: 'strength' | 'cardio';
  totalVolumeKg: number;
  prCount: number;
  setCount: number;
  distanceKm: number | null;
  paceSecondsPerKm: number | null;
}

async function hydrateRows(
  db: AnyDb,
  rows: Array<typeof sessions.$inferSelect>,
): Promise<SessionRowData[]> {
  if (rows.length === 0) return [];
  const sessionIds = rows.map((r) => r.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allSets = await (db as any)
    .select()
    .from(sessionSets)
    .orderBy(asc(sessionSets.sessionId), asc(sessionSets.exercisePosition), asc(sessionSets.setPosition));
  const setsBySession = new Map<number, Array<typeof sessionSets.$inferSelect>>();
  for (const s of allSets as Array<typeof sessionSets.$inferSelect>) {
    if (!sessionIds.includes(s.sessionId)) continue;
    const list = setsBySession.get(s.sessionId) ?? [];
    list.push(s);
    setsBySession.set(s.sessionId, list);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exMetaRows = await (db as any).select().from(exercisesTable);
  const exKindById = new Map<string, 'strength' | 'cardio'>();
  for (const row of exMetaRows as Array<typeof exercisesTable.$inferSelect>) {
    exKindById.set(row.id, row.kind as 'strength' | 'cardio');
  }

  return rows.map((r) => {
    const sets = setsBySession.get(r.id) ?? [];
    const firstKind = sets[0] ? exKindById.get(sets[0].exerciseId) : undefined;
    const mode: 'strength' | 'cardio' = firstKind === 'cardio' ? 'cardio' : 'strength';

    let distanceKm: number | null = null;
    let paceSecondsPerKm: number | null = null;
    if (mode === 'cardio' && sets[0]) {
      distanceKm = sets[0].distanceKm;
      const dur = sets[0].durationSeconds;
      paceSecondsPerKm =
        distanceKm != null && distanceKm > 0 && dur != null && dur > 0
          ? dur / distanceKm
          : null;
    }

    return {
      id: r.id,
      routineNameSnapshot: r.routineNameSnapshot,
      finishedAt: r.finishedAt ?? 0,
      durationSeconds: r.durationSeconds,
      mode,
      totalVolumeKg: r.totalVolumeKg,
      prCount: r.prCount,
      setCount: sets.length,
      distanceKm,
      paceSecondsPerKm,
    };
  });
}

export async function getRecentSessions(db: AnyDb, limit: number): Promise<SessionRowData[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (db as any)
    .select()
    .from(sessions)
    .where(eq(sessions.status, 'completed'))
    .orderBy(desc(sessions.finishedAt))
    .limit(limit);
  return hydrateRows(db, rows as Array<typeof sessions.$inferSelect>);
}

export async function listAllSessions(
  db: AnyDb,
  modeFilter?: 'strength' | 'cardio',
): Promise<SessionRowData[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (db as any)
    .select()
    .from(sessions)
    .where(eq(sessions.status, 'completed'))
    .orderBy(desc(sessions.finishedAt));
  const hydrated = await hydrateRows(db, rows as Array<typeof sessions.$inferSelect>);
  if (!modeFilter) return hydrated;
  return hydrated.filter((r) => r.mode === modeFilter);
}

export function finalizeSession(
  db: AnyDb,
  sessionId: number,
  finishedAt: number,
): Promise<CompletedSessionResult> {
  return new Promise((resolve, reject) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (db as any).transaction((tx: any) => {
        const head: { startedAt: number; status: string; routineNameSnapshot: string } | undefined =
          tx.select({
            startedAt: sessions.startedAt,
            status: sessions.status,
            routineNameSnapshot: sessions.routineNameSnapshot,
          }).from(sessions).where(eq(sessions.id, sessionId)).all()[0];
        if (!head) throw new Error(`Session ${sessionId} not found`);
        if (head.status !== 'draft') throw new Error(`Session ${sessionId} is not a draft`);

        const setsRows: Array<typeof sessionSets.$inferSelect> =
          tx.select().from(sessionSets).where(eq(sessionSets.sessionId, sessionId))
            .orderBy(asc(sessionSets.exercisePosition), asc(sessionSets.setPosition)).all();

        const exerciseIds = Array.from(new Set(setsRows.map((s) => s.exerciseId)));
        const snapshotRows = exerciseIds.length === 0
          ? []
          : tx.select({ exerciseId: prs.exerciseId, weightKg: prs.weightKg, reps: prs.reps })
              .from(prs).all()
              .filter((r: { exerciseId: string }) => exerciseIds.includes(r.exerciseId));
        const snapshot = new Map<string, { weightKg: number; reps: number }>();
        for (const r of snapshotRows as { exerciseId: string; weightKg: number; reps: number }[]) {
          snapshot.set(r.exerciseId, { weightKg: r.weightKg, reps: r.reps });
        }

        const detection = detectSessionPRs(
          snapshot,
          setsRows.map((s) => ({ exerciseId: s.exerciseId, reps: s.reps, weightKg: s.weightKg })),
        );

        const totalVolumeKg = computeStrengthVolume(
          setsRows.map((s) => ({ reps: s.reps, weightKg: s.weightKg })),
        );

        const durationSeconds = Math.round((finishedAt - head.startedAt) / 1000);

        tx.update(sessions)
          .set({
            status: 'completed',
            finishedAt,
            durationSeconds,
            totalVolumeKg,
            prCount: detection.newPRs.size,
          })
          .where(eq(sessions.id, sessionId))
          .run();

        for (let i = 0; i < setsRows.length; i++) {
          if (detection.isPrPerSet[i]) {
            tx.update(sessionSets)
              .set({ isPr: 1 })
              .where(eq(sessionSets.id, setsRows[i].id))
              .run();
          }
        }

        for (const [exerciseId, pr] of detection.newPRs) {
          tx.insert(prs).values({
            exerciseId,
            weightKg: pr.weightKg,
            reps: pr.reps,
            sessionId,
            achievedAt: finishedAt,
          }).onConflictDoUpdate({
            target: prs.exerciseId,
            set: { weightKg: pr.weightKg, reps: pr.reps, sessionId, achievedAt: finishedAt },
          }).run();
        }

        tx.insert(movementEntries).values({
          minutes: Math.round(durationSeconds / 60),
          kind: 'workout',
          note: head.routineNameSnapshot,
          occurredAt: finishedAt,
        }).run();

        return { sessionId, prCount: detection.newPRs.size, totalVolumeKg };
      });
      resolve(result);
    } catch (e) {
      reject(e);
    }
  });
}
