import { asc, desc, eq } from 'drizzle-orm';

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
