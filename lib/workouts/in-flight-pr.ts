import { detectSessionPRs, type PRSnapshot } from './pr-detection';
import type { SessionSetDraft } from '@/lib/db/queries/sessions';

export function getInFlightBadges(
  snapshot: PRSnapshot,
  drafts: SessionSetDraft[],
): boolean[] {
  return detectSessionPRs(
    snapshot,
    drafts.map((s) => ({ exerciseId: s.exerciseId, reps: s.reps, weightKg: s.weightKg })),
  ).isPrPerSet;
}

export function wouldThisSetBeAPR(
  snapshot: PRSnapshot,
  exerciseId: string,
  reps: number | null,
  weightKg: number | null,
): boolean {
  if (reps === null || weightKg === null) return false;
  const result = detectSessionPRs(snapshot, [{ exerciseId, reps, weightKg }]);
  return result.isPrPerSet[0];
}
