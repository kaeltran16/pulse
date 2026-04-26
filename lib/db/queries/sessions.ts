import { and, asc, desc, eq } from 'drizzle-orm';

import { detectSessionPRs } from '../../workouts/pr-detection';
import { computeStrengthVolume } from '../../workouts/volume';
import { movementEntries, prs, sessions, sessionSets } from '../schema';
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

export interface SessionFull extends SessionSummary {
  sets: (typeof sessionSets.$inferSelect)[];
}

export function insertCompletedSession(
  db: AnyDb,
  draft: CompletedSessionDraft,
): Promise<CompletedSessionResult> {
  return new Promise((resolve, reject) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (db as any).transaction((tx: any) => {
        const exerciseIds = Array.from(new Set(draft.sets.map((s) => s.exerciseId)));
        const snapshotRows = exerciseIds.length === 0
          ? []
          : tx.select({ exerciseId: prs.exerciseId, weightKg: prs.weightKg, reps: prs.reps })
              .from(prs)
              .all()
              .filter((r: { exerciseId: string }) => exerciseIds.includes(r.exerciseId));
        const snapshot = new Map<string, { weightKg: number; reps: number }>();
        for (const r of snapshotRows as { exerciseId: string; weightKg: number; reps: number }[]) {
          snapshot.set(r.exerciseId, { weightKg: r.weightKg, reps: r.reps });
        }

        const detection = detectSessionPRs(
          snapshot,
          draft.sets.map((s) => ({ exerciseId: s.exerciseId, reps: s.reps, weightKg: s.weightKg })),
        );

        const totalVolumeKg = computeStrengthVolume(
          draft.sets.map((s) => ({ reps: s.reps, weightKg: s.weightKg })),
        );

        const durationSeconds = Math.round((draft.finishedAt - draft.startedAt) / 1000);
        const insertedSession = tx.insert(sessions).values({
          routineId: draft.routineId,
          routineNameSnapshot: draft.routineNameSnapshot,
          startedAt: draft.startedAt,
          finishedAt: draft.finishedAt,
          durationSeconds,
          totalVolumeKg,
          prCount: detection.newPRs.size,
        }).returning({ id: sessions.id }).all();
        const sessionId: number = insertedSession[0].id;

        for (let i = 0; i < draft.sets.length; i++) {
          const s = draft.sets[i];
          tx.insert(sessionSets).values({
            sessionId,
            exerciseId: s.exerciseId,
            exercisePosition: s.exercisePosition,
            setPosition: s.setPosition,
            reps: s.reps,
            weightKg: s.weightKg,
            durationSeconds: s.durationSeconds,
            distanceKm: s.distanceKm,
            isPr: detection.isPrPerSet[i] ? 1 : 0,
          }).run();
        }

        for (const [exerciseId, pr] of detection.newPRs) {
          tx.insert(prs).values({
            exerciseId,
            weightKg: pr.weightKg,
            reps: pr.reps,
            sessionId,
            achievedAt: draft.finishedAt,
          }).onConflictDoUpdate({
            target: prs.exerciseId,
            set: {
              weightKg: pr.weightKg,
              reps: pr.reps,
              sessionId,
              achievedAt: draft.finishedAt,
            },
          }).run();
        }

        tx.insert(movementEntries).values({
          minutes: Math.round(durationSeconds / 60),
          kind: 'workout',
          note: draft.routineNameSnapshot,
          occurredAt: draft.finishedAt,
        }).run();

        return { sessionId, prCount: detection.newPRs.size, totalVolumeKg };
      });
      resolve(result);
    } catch (e) {
      reject(e);
    }
  });
}

export async function listSessions(
  db: AnyDb,
  args: { limit?: number; offset?: number } = {},
): Promise<SessionSummary[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (db as any).select().from(sessions).orderBy(desc(sessions.startedAt));
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
