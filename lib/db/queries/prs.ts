import { inArray } from 'drizzle-orm';

import { prs } from '../schema';
import { type AnyDb } from './onboarding';

export type PRSnapshot = Map<string, { weightKg: number; reps: number }>;

export async function getPRsForExercises(db: AnyDb, exerciseIds: string[]): Promise<PRSnapshot> {
  const out: PRSnapshot = new Map();
  if (exerciseIds.length === 0) return out;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (db as any)
    .select({ exerciseId: prs.exerciseId, weightKg: prs.weightKg, reps: prs.reps })
    .from(prs)
    .where(inArray(prs.exerciseId, exerciseIds));

  for (const row of rows as { exerciseId: string; weightKg: number; reps: number }[]) {
    out.set(row.exerciseId, { weightKg: row.weightKg, reps: row.reps });
  }
  return out;
}
